import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ACTIVITY_DELETE_WINDOW_MESSAGE } from '../common/domain/deletion-window';
import { ACTIVITY_CREATED } from '../common/events/domain-events';
import { DomainEventsService } from '../common/events/domain-events.service';
import {
  formatWallClockIso,
  formatWallClockPtBr,
  parseWallClockInput,
} from '../common/time/legacy-clock';
import { PrismaService } from '../prisma/prisma.service';
import { canViewTicket } from '../tickets/ticket.policy';
import {
  activityDurationHours,
  findActivityConflict,
  validateActivityPeriod,
} from './activity-period';
import {
  canCreateActivity,
  canDeleteActivity,
  canEditActivity,
} from './activity.policy';
import {
  ActivityListResponse,
  ActivityResponse,
  CreateActivityDto,
  UpdateActivityDto,
} from './dto/activity.dto';

const ACTIVITY_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ActivityInclude;

type ActivityWithAuthor = Prisma.ActivityGetPayload<{
  include: typeof ACTIVITY_INCLUDE;
}>;

const INVALID_DATES_MESSAGE = 'Datas inválidas. Use data e hora válidas.';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventsService,
  ) {}

  // -------------------------------------------------------------------------

  async list(user: AuthenticatedUser, ticketId: number): Promise<ActivityListResponse> {
    // Reaproveita o isolamento por cliente do domínio de chamados.
    await this.loadVisibleTicket(user, ticketId);

    const activities = await this.prisma.activity.findMany({
      where: { ticketId },
      include: ACTIVITY_INCLUDE,
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
    });

    const items = activities.map((activity) => this.toResponse(user, activity));

    return {
      items,
      totalHours: round2(items.reduce((total, item) => total + item.durationHours, 0)),
    };
  }

  // -------------------------------------------------------------------------

  async create(
    user: AuthenticatedUser,
    ticketId: number,
    dto: CreateActivityDto,
  ): Promise<ActivityResponse> {
    if (!canCreateActivity(user)) {
      throw new ForbiddenException('Somente técnicos podem registrar atividades.');
    }

    const ticket = await this.loadTicketForActivity(ticketId);
    const { startedAt, endedAt } = this.parsePeriod(dto.startedAt, dto.endedAt);

    this.assertValidPeriod(startedAt, endedAt);
    await this.assertNoConflict(user.id, startedAt, endedAt);

    const activity = await this.prisma.activity.create({
      data: {
        ticketId: ticket.id,
        notes: dto.notes,
        startedAt,
        endedAt,
        // O autor é sempre quem está autenticado — nunca vem do corpo.
        createdById: user.id,
      },
      include: ACTIVITY_INCLUDE,
    });

    // Publicado após o commit; o handler de e-mail já existe desde a Fase 07.
    await this.events.publish(ACTIVITY_CREATED, {
      activityId: activity.id,
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      notes: activity.notes,
      startedAt: activity.startedAt,
      endedAt: activity.endedAt,
      technicianId: user.id,
      technicianName: activity.createdBy.name,
      clientId: ticket.client.id,
      clientName: ticket.client.name,
      clientEmail: ticket.client.email,
    });

    return this.toResponse(user, activity);
  }

  // -------------------------------------------------------------------------

  async update(
    user: AuthenticatedUser,
    ticketId: number,
    activityId: number,
    dto: UpdateActivityDto,
  ): Promise<ActivityResponse> {
    if (!canCreateActivity(user)) {
      throw new ForbiddenException('Somente técnicos podem editar atividades.');
    }

    const existing = await this.loadActivityOfTicket(ticketId, activityId);

    // ⚠️ Somente o autor edita — sem exceção para superuser (§8 nota ¹).
    if (!canEditActivity(user, existing)) {
      throw new ForbiddenException('Você só pode editar atividades lançadas por você.');
    }

    const { startedAt, endedAt } = this.parsePeriod(dto.startedAt, dto.endedAt);

    this.assertValidPeriod(startedAt, endedAt);
    // A própria atividade sai da checagem de conflito.
    await this.assertNoConflict(user.id, startedAt, endedAt, existing.id);

    const activity = await this.prisma.activity.update({
      where: { id: activityId },
      data: { notes: dto.notes, startedAt, endedAt },
      include: ACTIVITY_INCLUDE,
    });

    return this.toResponse(user, activity);
  }

  // -------------------------------------------------------------------------

  async remove(
    user: AuthenticatedUser,
    ticketId: number,
    activityId: number,
  ): Promise<void> {
    if (!canCreateActivity(user)) {
      throw new ForbiddenException('Somente técnicos podem excluir atividades.');
    }

    const existing = await this.loadActivityOfTicket(ticketId, activityId);

    // Diferente da edição, o legado NÃO exige autoria para excluir — apenas a
    // janela de mês corrente (ou superuser).
    if (!canDeleteActivity(user, existing)) {
      throw new ForbiddenException(ACTIVITY_DELETE_WINDOW_MESSAGE);
    }

    await this.prisma.activity.delete({ where: { id: activityId } });
  }

  // -------------------------------------------------------------------------

  /** Converte a entrada em hora de parede, com a mensagem de erro do legado. */
  private parsePeriod(
    startedAtRaw: string,
    endedAtRaw: string,
  ): { startedAt: Date; endedAt: Date } {
    try {
      return {
        startedAt: parseWallClockInput(startedAtRaw),
        endedAt: parseWallClockInput(endedAtRaw),
      };
    } catch {
      throw new BadRequestException(INVALID_DATES_MESSAGE);
    }
  }

  private assertValidPeriod(startedAt: Date, endedAt: Date): void {
    const error = validateActivityPeriod(startedAt, endedAt);
    if (error) {
      throw new BadRequestException(error);
    }
  }

  /**
   * Conflito é **global por técnico**: atravessa chamados, dias e meses.
   *
   * A consulta filtra pelo predicado do legado no banco (usando o índice
   * `(created_by_id, started_at, ended_at)`); o desempate por início ascendente
   * fica na função pura, que já é testada isoladamente.
   */
  private async assertNoConflict(
    technicianId: number,
    startedAt: Date,
    endedAt: Date,
    excludeActivityId?: number,
  ): Promise<void> {
    const candidates = await this.prisma.activity.findMany({
      where: {
        createdById: technicianId,
        startedAt: { lt: endedAt },
        endedAt: { gt: startedAt },
        ...(excludeActivityId ? { id: { not: excludeActivityId } } : {}),
      },
      select: { id: true, startedAt: true, endedAt: true },
      orderBy: { startedAt: 'asc' },
    });

    const conflict = findActivityConflict(
      candidates,
      startedAt,
      endedAt,
      excludeActivityId,
    );

    if (conflict) {
      throw new ConflictException(
        'Conflito de horário: já existe uma atividade sua nesse período ' +
          `(${formatWallClockPtBr(conflict.startedAt)} ` +
          `até ${formatWallClockPtBr(conflict.endedAt)}).`,
      );
    }
  }

  /** Chamado visível para o usuário, ou 404 (não revela chamados alheios). */
  private async loadVisibleTicket(user: AuthenticatedUser, ticketId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, clientId: true },
    });

    if (!ticket || !canViewTicket(user, ticket)) {
      throw new NotFoundException('Chamado não encontrado.');
    }
    return ticket;
  }

  /** Chamado com o cliente, para montar o evento de notificação. */
  private async loadTicketForActivity(ticketId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        client: { select: { id: true, name: true, email: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Chamado não encontrado.');
    }
    return ticket;
  }

  /**
   * Atividade que pertence ao chamado informado.
   *
   * O legado faz `filter_by(id=activity_id, ticket_id=ticket.id)`: uma
   * atividade de outro chamado devolve 404, mesmo existindo.
   */
  private async loadActivityOfTicket(ticketId: number, activityId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticket) {
      throw new NotFoundException('Chamado não encontrado.');
    }

    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, ticketId },
    });
    if (!activity) {
      throw new NotFoundException('Atividade não encontrada.');
    }
    return activity;
  }

  private toResponse(
    user: AuthenticatedUser,
    activity: ActivityWithAuthor,
  ): ActivityResponse {
    return {
      id: activity.id,
      ticketId: activity.ticketId,
      notes: activity.notes,
      startedAt: formatWallClockIso(activity.startedAt),
      endedAt: formatWallClockIso(activity.endedAt),
      startedLabel: formatWallClockPtBr(activity.startedAt),
      endedLabel: formatWallClockPtBr(activity.endedAt),
      durationHours: activityDurationHours(activity.startedAt, activity.endedAt),
      createdBy: activity.createdBy,
      // Dicas de UI. A autorização real acontece no service, sempre.
      canEdit: canEditActivity(user, activity),
      canDelete: canDeleteActivity(user, activity),
    };
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
