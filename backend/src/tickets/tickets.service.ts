import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { TICKET_DELETE_WINDOW_MESSAGE } from '../common/domain/deletion-window';
import { statusLabel, TicketStatus } from '../common/domain/legacy-enums';
import { TICKET_CREATED, TICKET_STATUS_CHANGED } from '../common/events/domain-events';
import { DomainEventsService } from '../common/events/domain-events.service';
import { instantToWallClockParts } from '../common/time/legacy-clock';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChangeTicketStatusDto,
  CreateTicketDto,
  ListTicketsQueryDto,
  PaginatedTicketsResponse,
  TicketResponse,
  TICKET_STATUS_FILTERS,
  TicketStatusFilter,
  UpdateTicketDto,
} from './dto/ticket.dto';
import {
  canChangeStatus,
  canDeleteTicket,
  canEditTicket,
  canViewTicket,
  resolveTicketClientId,
} from './ticket.policy';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/** Status considerados concluídos pelo filtro `nao_concluidos` do legado. */
const COMPLETED_STATUSES: TicketStatus[] = ['resolvido', 'fechado'];

const TICKET_INCLUDE = {
  client: { select: { id: true, name: true, email: true } },
  technician: { select: { id: true, name: true, email: true } },
  systemModule: { select: { id: true, name: true, isActive: true } },
  _count: { select: { activities: true } },
} satisfies Prisma.TicketInclude;

type TicketWithRelations = Prisma.TicketGetPayload<{ include: typeof TICKET_INCLUDE }>;

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventsService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Listagem
  // -------------------------------------------------------------------------

  /**
   * Listagem paginada com os filtros do dashboard do legado.
   *
   * Sobre o período: o legado usa `db.extract("year"/"month", Ticket.created_at)`.
   * Como `created_at` é um instante UTC, a extração devolve componentes **UTC**.
   * Aqui usamos um intervalo `[início, fim)` em UTC, que é logicamente idêntico
   * e permite usar o índice de `created_at` em vez de forçar varredura.
   */
  async list(
    user: AuthenticatedUser,
    query: ListTicketsQueryDto,
  ): Promise<PaginatedTicketsResponse> {
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const where: Prisma.TicketWhereInput = {};

    // Isolamento por cliente aplicado no WHERE: um cliente nunca recebe
    // chamado de outro, nem por paginação nem por busca.
    if (user.role === 'client') {
      where.clientId = user.id;
    }

    const period = this.resolvePeriod(query);
    if (period) {
      where.createdAt = { gte: period.start, lt: period.end };
    }

    const statusFilter = this.resolveStatusFilter(query.status);
    if (statusFilter === 'nao_concluidos') {
      where.status = { notIn: COMPLETED_STATUSES };
    } else if (statusFilter !== 'all') {
      where.status = statusFilter;
    }

    const search = query.search?.trim();
    if (search) {
      // Busca por ID exato ou por título, como as telas do legado.
      const asId = /^\d+$/.test(search) ? Number(search) : null;
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        ...(asId !== null ? [{ id: asId }] : []),
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        include: TICKET_INCLUDE,
        // Mesma ordenação do legado: created_at DESC.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      items: items.map(toTicketResponse),
      total,
      page,
      pageSize,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
      appliedFilters: {
        year: period?.year ?? null,
        month: period?.month ?? null,
        status: statusFilter,
        search: search ?? null,
      },
    };
  }

  /** Anos com chamados no escopo do usuário, para o seletor de período. */
  async availableYears(user: AuthenticatedUser): Promise<number[]> {
    const where: Prisma.TicketWhereInput = {};
    if (user.role === 'client') {
      where.clientId = user.id;
    }

    const rows = await this.prisma.ticket.findMany({
      where,
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const years = new Set(rows.map((row) => row.createdAt.getUTCFullYear()));
    // O legado sempre inclui o ano corrente, mesmo sem chamados.
    years.add(instantToWallClockParts(new Date()).year);

    return Array.from(years).sort((left, right) => right - left);
  }

  /**
   * `resolve_period` do legado: default é o mês corrente em hora local, e mês
   * fora de 1..12 cai para o mês corrente em vez de dar erro.
   */
  private resolvePeriod(
    query: ListTicketsQueryDto,
  ): { year: number; month: number; start: Date; end: Date } | null {
    if (query.allPeriods) return null;

    const nowParts = instantToWallClockParts(new Date());
    const year = query.year ?? nowParts.year;
    const rawMonth = query.month ?? nowParts.month;
    const month = rawMonth >= 1 && rawMonth <= 12 ? rawMonth : nowParts.month;

    // Fronteiras em UTC, para casar com a extração do legado sobre created_at.
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end =
      month === 12
        ? new Date(Date.UTC(year + 1, 0, 1))
        : new Date(Date.UTC(year, month, 1));

    return { year, month, start, end };
  }

  /** Valor desconhecido cai para `nao_concluidos`, como no legado. */
  private resolveStatusFilter(raw: string | undefined): TicketStatusFilter {
    const value = (raw ?? '').trim().toLowerCase();
    return (TICKET_STATUS_FILTERS as readonly string[]).includes(value)
      ? (value as TicketStatusFilter)
      : 'nao_concluidos';
  }

  // -------------------------------------------------------------------------
  // Detalhe
  // -------------------------------------------------------------------------

  async findOne(user: AuthenticatedUser, id: number): Promise<TicketResponse> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: TICKET_INCLUDE,
    });

    // 404 tanto para inexistente quanto para chamado de outro cliente: não
    // revela a existência de chamados alheios.
    if (!ticket || !canViewTicket(user, ticket)) {
      throw new NotFoundException('Chamado não encontrado.');
    }

    return toTicketResponse(ticket);
  }

  // -------------------------------------------------------------------------
  // Criação
  // -------------------------------------------------------------------------

  async create(user: AuthenticatedUser, dto: CreateTicketDto): Promise<TicketResponse> {
    const { clientId, requiresExplicitClient } = resolveTicketClientId(
      user,
      dto.clientId,
    );

    if (requiresExplicitClient && clientId === null) {
      throw new BadRequestException('Selecione um cliente para abrir o chamado.');
    }

    // Cliente precisa existir E ter papel client — igual ao legado.
    const client = await this.prisma.user.findFirst({
      where: { id: clientId!, role: 'client' },
      select: { id: true, name: true, email: true },
    });
    if (!client) {
      throw new BadRequestException('Cliente inválido.');
    }

    // Na CRIAÇÃO o módulo precisa estar ATIVO (na edição, não — ver update()).
    const systemModule = await this.prisma.systemModule.findFirst({
      where: { id: dto.systemModuleId, isActive: true },
      select: { id: true },
    });
    if (!systemModule) {
      throw new BadRequestException('Módulo inválido.');
    }

    const technicianId = await this.resolveTechnicianId(dto.technicianId ?? null);

    const ticket = await this.prisma.ticket.create({
      data: {
        title: dto.title,
        description: dto.description,
        clientId: client.id,
        technicianId,
        systemModuleId: systemModule.id,
        // `created_at` vem do default UTC do banco (ver schema.prisma).
      },
      include: TICKET_INCLUDE,
    });

    // Evento publicado APÓS o commit; a Fase 07 anexa o envio de e-mail.
    await this.events.publish(TICKET_CREATED, {
      ticketId: ticket.id,
      title: ticket.title,
      description: ticket.description,
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      technicianId,
    });

    return toTicketResponse(ticket);
  }

  // -------------------------------------------------------------------------
  // Edição
  // -------------------------------------------------------------------------

  async update(
    user: AuthenticatedUser,
    id: number,
    dto: UpdateTicketDto,
  ): Promise<TicketResponse> {
    if (!canEditTicket(user)) {
      throw new ForbiddenException('Você não tem permissão para editar chamados.');
    }

    const existing = await this.prisma.ticket.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Chamado não encontrado.');
    }

    const client = await this.prisma.user.findFirst({
      where: { id: dto.clientId, role: 'client' },
      select: { id: true, name: true, email: true },
    });
    if (!client) {
      throw new BadRequestException('Cliente inválido.');
    }

    // DIFERENÇA DELIBERADA em relação à criação: aqui o legado faz
    // `SystemModule.query.filter_by(id=...)`, SEM filtrar por is_active. Um
    // chamado antigo cujo módulo foi desativado continua editável.
    const systemModule = await this.prisma.systemModule.findUnique({
      where: { id: dto.systemModuleId },
      select: { id: true },
    });
    if (!systemModule) {
      throw new BadRequestException('Módulo inválido.');
    }

    const technicianId = await this.resolveTechnicianId(dto.technicianId ?? null);

    const previousStatus = existing.status;

    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        clientId: client.id,
        technicianId,
        systemModuleId: systemModule.id,
      },
      include: TICKET_INCLUDE,
    });

    if (previousStatus !== dto.status) {
      await this.publishStatusChanged(ticket, previousStatus);
    }

    return toTicketResponse(ticket);
  }

  // -------------------------------------------------------------------------
  // Mudança de status
  // -------------------------------------------------------------------------

  async changeStatus(
    user: AuthenticatedUser,
    id: number,
    dto: ChangeTicketStatusDto,
  ): Promise<TicketResponse> {
    if (!canChangeStatus(user)) {
      throw new ForbiddenException('Você não tem permissão para alterar o status.');
    }

    const existing = await this.prisma.ticket.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Chamado não encontrado.');
    }

    const previousStatus = existing.status;

    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: dto.status },
      include: TICKET_INCLUDE,
    });

    // O legado só notifica quando o status realmente mudou.
    if (previousStatus !== dto.status) {
      await this.publishStatusChanged(ticket, previousStatus);
    }

    return toTicketResponse(ticket);
  }

  // -------------------------------------------------------------------------
  // Exclusão
  // -------------------------------------------------------------------------

  async remove(user: AuthenticatedUser, id: number): Promise<void> {
    if (!canEditTicket(user)) {
      throw new ForbiddenException('Você não tem permissão para excluir chamados.');
    }

    const existing = await this.prisma.ticket.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Chamado não encontrado.');
    }

    if (!canDeleteTicket(user, existing)) {
      throw new ForbiddenException(TICKET_DELETE_WINDOW_MESSAGE);
    }

    // As atividades caem por ON DELETE CASCADE, reproduzindo o
    // cascade="all, delete-orphan" do legado.
    await this.prisma.ticket.delete({ where: { id } });

    // A exclusao leva as atividades junto, entao apaga horas ja lancadas --
    // motivo suficiente para deixar rastro de quem fez.
    await this.audit.record({
      action: AUDIT_ACTIONS.TICKET_DELETED,
      entityType: 'ticket',
      entityId: id,
      metadata: {
        title: existing.title,
        status: existing.status,
        clientId: existing.clientId,
      },
    });
  }

  // -------------------------------------------------------------------------

  /** Técnico é opcional, mas quando informado precisa existir com papel technician. */
  private async resolveTechnicianId(
    technicianId: number | null,
  ): Promise<number | null> {
    if (technicianId === null) return null;

    const technician = await this.prisma.user.findFirst({
      where: { id: technicianId, role: 'technician' },
      select: { id: true },
    });
    if (!technician) {
      throw new BadRequestException('Técnico inválido.');
    }
    return technician.id;
  }

  private async publishStatusChanged(
    ticket: TicketWithRelations,
    previousStatus: string,
  ): Promise<void> {
    await this.events.publish(TICKET_STATUS_CHANGED, {
      ticketId: ticket.id,
      title: ticket.title,
      previousStatus,
      newStatus: ticket.status,
      clientId: ticket.client.id,
      clientName: ticket.client.name,
      clientEmail: ticket.client.email,
    });
  }
}

function toTicketResponse(ticket: TicketWithRelations): TicketResponse {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    statusLabel: statusLabel(ticket.status),
    createdAt: ticket.createdAt.toISOString(),
    client: ticket.client,
    technician: ticket.technician,
    systemModule: ticket.systemModule,
    activityCount: ticket._count.activities,
  };
}
