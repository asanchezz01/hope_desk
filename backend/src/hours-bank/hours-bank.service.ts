import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  formatWallClockIso,
  instantToWallClockStorage,
  monthPeriodBounds,
  parseWallClockInput,
  storageToWallClock,
} from '../common/time/legacy-clock';
import { ParametersService } from '../parameters/parameters.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  HoursBankQueryDto,
  HoursBankResponse,
  MonthlyHoursSummaryResponse,
} from './dto/hours-bank.dto';
import {
  calculateHoursBank,
  calculatePaidHoursForMonth,
  HoursBankActivity,
  HoursBankPayment,
} from './hours-bank.calculator';

/**
 * Camada de acesso a dados do banco de horas.
 *
 * Toda a aritmética vive em `hours-bank.calculator.ts`, que é puro e verificado
 * contra o Flask. Aqui só buscamos os dados e aplicamos o escopo por perfil.
 */
@Injectable()
export class HoursBankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parameters: ParametersService,
  ) {}

  async getHoursBank(
    user: AuthenticatedUser,
    query: HoursBankQueryDto,
  ): Promise<HoursBankResponse> {
    const reference = this.resolveReference(query.reference);

    const [parameterValues, activities, payments] = await Promise.all([
      this.parameters.getMany(['monthly_hours_allowance', 'hours_bank_closing_date']),
      this.loadActivitiesForUser(user),
      this.loadPayments(),
    ]);

    const result = calculateHoursBank({
      monthlyHoursAllowanceRaw: parameterValues.monthly_hours_allowance,
      hoursBankClosingDateRaw: parameterValues.hours_bank_closing_date,
      reference,
      activities,
      payments,
    });

    return {
      netAccumulatedHours: result.netAccumulatedHours,
      grossExcessHours: result.grossExcessHours,
      paidHoursInCycle: result.paidHoursInCycle,
      franchiseHours: result.franchiseHours,
      totalConsumedHours: result.totalConsumedHours,
      cycleStart: formatWallClockIso(result.cycleStart),
      cycleEnd: formatWallClockIso(result.cycleEnd),
      cycleStartLabel: formatDayLabel(result.cycleStart),
      cycleEndLabel: formatDayLabel(result.cycleEnd),
      monthlyBreakdown: result.monthlyBreakdown,
      reference: formatWallClockIso(reference),
    };
  }

  /**
   * Resumo mensal: horas do período, horas vindas de chamados de outros meses e
   * horas pagas no mês.
   */
  async getMonthlySummary(
    user: AuthenticatedUser,
    query: HoursBankQueryDto,
  ): Promise<MonthlyHoursSummaryResponse> {
    const nowParts = storageToWallClock(this.resolveReference(query.reference));
    const year = query.year ?? nowParts.year;
    const month = query.month ?? nowParts.month;

    const [periodStart, periodEnd] = monthPeriodBounds(year, month);

    const [activities, payments] = await Promise.all([
      this.loadActivitiesForUser(user, { periodStart, periodEnd }),
      this.loadPayments(),
    ]);

    const periodActivityHours = sumClippedHours(activities, periodStart, periodEnd);

    const externalActivities = await this.loadExternalTicketActivities(
      user,
      year,
      month,
      periodStart,
      periodEnd,
    );
    const externalTicketActivityHours = sumClippedHours(
      externalActivities,
      periodStart,
      periodEnd,
    );

    return {
      year,
      month,
      periodActivityHours: round2(periodActivityHours),
      externalTicketActivityHours: round2(externalTicketActivityHours),
      paidHoursInMonth: calculatePaidHoursForMonth(payments, year, month),
    };
  }

  /**
   * Atividades no escopo do usuário.
   *
   * Cliente vê somente atividades de chamados dos quais é o cliente — mesmo
   * filtro `Ticket.client_id == user_id` do legado.
   */
  private async loadActivitiesForUser(
    user: AuthenticatedUser,
    period?: { periodStart: Date; periodEnd: Date },
  ): Promise<HoursBankActivity[]> {
    const where: Prisma.ActivityWhereInput = {};

    if (user.role === 'client') {
      where.ticket = { clientId: user.id };
    }

    if (period) {
      // Mesmo recorte do legado: ended_at > início AND started_at < fim.
      where.endedAt = { gt: period.periodStart };
      where.startedAt = { lt: period.periodEnd };
    }

    return this.prisma.activity.findMany({
      where,
      select: { startedAt: true, endedAt: true },
    });
  }

  /**
   * `calculate_external_ticket_activity_hours` do legado: atividades do período
   * cujo **chamado** foi criado em outro mês.
   *
   * Detalhe preservado: o recorte da atividade usa fronteiras de **parede**
   * (`month_period_bounds`), mas o mês do chamado vem de
   * `extract(year/month, ticket.created_at)`, que é **UTC**. É a mesma família
   * de inconsistência do §4.1 e está preservada de propósito.
   */
  private async loadExternalTicketActivities(
    user: AuthenticatedUser,
    year: number,
    month: number,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<HoursBankActivity[]> {
    const where: Prisma.ActivityWhereInput = {
      endedAt: { gt: periodStart },
      startedAt: { lt: periodEnd },
      ticket: {
        // "criado em outro mês" = fora do intervalo UTC do mês selecionado.
        NOT: {
          createdAt: {
            gte: new Date(Date.UTC(year, month - 1, 1)),
            lt:
              month === 12
                ? new Date(Date.UTC(year + 1, 0, 1))
                : new Date(Date.UTC(year, month, 1)),
          },
        },
        ...(user.role === 'client' ? { clientId: user.id } : {}),
      },
    };

    return this.prisma.activity.findMany({
      where,
      select: { startedAt: true, endedAt: true },
    });
  }

  private async loadPayments(): Promise<HoursBankPayment[]> {
    // Pagamentos não têm escopo por cliente no legado: são da empresa.
    return this.prisma.paymentRecord.findMany({
      select: { paidAt: true, paidHours: true },
    });
  }

  /** Referência do cálculo: informada pelo cliente ou "agora" em São Paulo. */
  private resolveReference(raw: string | undefined): Date {
    if (!raw) {
      return instantToWallClockStorage(new Date());
    }
    try {
      return parseWallClockInput(raw);
    } catch (error) {
      throw new BadRequestException(`Referência inválida: ${(error as Error).message}`);
    }
  }
}

const MS_PER_HOUR = 3_600_000;

/** Soma as horas de cada atividade recortada na janela, nunca negativas. */
function sumClippedHours(
  activities: HoursBankActivity[],
  windowStart: Date,
  windowEnd: Date,
): number {
  let milliseconds = 0;
  for (const activity of activities) {
    const start = Math.max(activity.startedAt.getTime(), windowStart.getTime());
    const end = Math.min(activity.endedAt.getTime(), windowEnd.getTime());
    milliseconds += Math.max(end - start, 0);
  }
  return milliseconds / MS_PER_HOUR;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** dd/mm/aaaa, como `cycle_start.strftime("%d/%m/%Y")` do legado. */
function formatDayLabel(stored: Date): string {
  const parts = storageToWallClock(stored);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(parts.day)}/${pad(parts.month)}/${parts.year}`;
}
