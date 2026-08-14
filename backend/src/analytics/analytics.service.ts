import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { statusLabel } from '../common/domain/legacy-enums';
import {
  addMonths,
  instantToWallClockStorage,
  monthPeriodBounds,
  storageToWallClock,
  wallClockToStorage,
} from '../common/time/legacy-clock';
import { HoursBankService } from '../hours-bank/hours-bank.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ANALYTICS_STATUS_META,
  AnalyticsActivityRow,
  AnalyticsBucket,
  AnalyticsTicketRow,
  AnalyticsTrendPoint,
  BucketMode,
  CountByKey,
  MONTH_SHORT_PT,
  MONTHS_PT,
} from './analytics.types';
import { AnalyticsQueryDto, AnalyticsResponse } from './dto/analytics.dto';

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const COMPLETED_STATUSES = ['resolvido', 'fechado'];
const BACKLOG_STATUSES = ['aberto', 'em_andamento'];

const TICKET_INCLUDE = {
  client: { select: { id: true, name: true } },
  technician: { select: { id: true, name: true } },
  systemModule: { select: { id: true, name: true } },
  activities: {
    select: { startedAt: true, endedAt: true },
  },
} satisfies Prisma.TicketInclude;

interface ResolvedPeriod {
  selectedYear: number | null;
  selectedMonth: number | null;
  /** Fronteiras em espaço de PAREDE, como `month_period_bounds` do legado. */
  periodStart: Date;
  periodEnd: Date;
  bucketMode: BucketMode;
  buckets: AnalyticsBucket[];
  periodLabel: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hoursBank: HoursBankService,
  ) {}

  async getAnalytics(
    user: AuthenticatedUser,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsResponse> {
    const now = instantToWallClockStorage(new Date());
    const period = await this.resolvePeriod(user, query, now);

    const ticketWhere = this.scopedTicketWhere(user);

    const [periodTickets, periodActivities, availableYears, backlog, hoursBank] =
      await Promise.all([
        this.prisma.ticket.findMany({
          where: {
            ...ticketWhere,
            createdAt: { gte: period.periodStart, lt: period.periodEnd },
          },
          include: TICKET_INCLUDE,
          orderBy: { createdAt: 'desc' },
        }),
        this.loadPeriodActivities(user, period.periodStart, period.periodEnd),
        this.loadAvailableYears(user, now),
        this.loadBacklog(user, now),
        this.hoursBank.getHoursBank(user, {}),
      ]);

    // --- atividades recortadas no período ---
    const activityRows: AnalyticsActivityRow[] = [];
    const technicianNamesByTicket = new Map<number, Set<string>>();
    const hoursByTicket = new Map<number, number>();

    for (const activity of periodActivities) {
      const overlapStart = Math.max(
        activity.startedAt.getTime(),
        period.periodStart.getTime(),
      );
      const overlapEnd = Math.min(
        activity.endedAt.getTime(),
        period.periodEnd.getTime(),
      );
      const hours = Math.max(overlapEnd - overlapStart, 0) / MS_PER_HOUR;
      if (hours <= 0) continue;

      const technicianName = activity.createdBy?.name ?? 'Técnico não informado';
      const names = technicianNamesByTicket.get(activity.ticketId) ?? new Set<string>();
      names.add(technicianName);
      technicianNamesByTicket.set(activity.ticketId, names);

      hoursByTicket.set(
        activity.ticketId,
        (hoursByTicket.get(activity.ticketId) ?? 0) + hours,
      );

      activityRows.push({
        ticketId: activity.ticketId,
        // O bucket usa o INÍCIO RECORTADO, como `clip_hours` do legado.
        bucket: bucketOf(new Date(overlapStart), period.bucketMode),
        technician: technicianName,
        hours: round2(hours),
        status: activity.ticket.status,
        module: activity.ticket.systemModule?.name ?? 'Sem módulo',
        client: activity.ticket.client?.name ?? '-',
      });
    }

    // --- linhas de chamado ---
    const ticketRows: AnalyticsTicketRow[] = periodTickets.map((ticket) => {
      const firstActivity = ticket.activities.reduce<{ startedAt: Date } | null>(
        (earliest, item) =>
          !earliest || item.startedAt.getTime() < earliest.startedAt.getTime()
            ? item
            : earliest,
        null,
      );

      // Soma TODAS as atividades do chamado (propriedade `total_hours` do legado),
      // não apenas as recortadas no período.
      const totalHours =
        ticket.activities.reduce(
          (total, item) =>
            total + Math.max(item.endedAt.getTime() - item.startedAt.getTime(), 0),
          0,
        ) / MS_PER_HOUR;

      const technicians = new Set(technicianNamesByTicket.get(ticket.id) ?? []);
      if (ticket.technician) {
        technicians.add(ticket.technician.name);
      }

      const isConcluded = COMPLETED_STATUSES.includes(ticket.status);

      return {
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        statusLabel: statusLabel(ticket.status),
        module: ticket.systemModule?.name ?? 'Sem módulo',
        client: ticket.client?.name ?? '-',
        technician: ticket.technician?.name ?? '-',
        technicians: Array.from(technicians).sort((a, b) =>
          a.localeCompare(b, 'pt-BR'),
        ),
        bucket: bucketOf(ticket.createdAt, period.bucketMode),
        createdAt: ticket.createdAt.toISOString(),
        createdLabel: formatDateTimeLabel(ticket.createdAt),
        hours: round2(totalHours),
        responseHours: firstActivity
          ? round2(
              // Subtração mista do legado: parede − UTC. Ver §13.
              Math.max(
                firstActivity.startedAt.getTime() - ticket.createdAt.getTime(),
                0,
              ) / MS_PER_HOUR,
            )
          : null,
        ageDays: isConcluded
          ? null
          : Math.max(
              Math.floor((now.getTime() - ticket.createdAt.getTime()) / MS_PER_DAY),
              0,
            ),
      };
    });

    // --- agregações ---
    const hoursByBucket: Record<string, number> = {};
    const ticketsByBucket: Record<string, number> = {};
    for (const bucket of period.buckets) {
      hoursByBucket[bucket.key] = 0;
      ticketsByBucket[bucket.key] = 0;
    }
    for (const row of activityRows) {
      hoursByBucket[row.bucket] = round2((hoursByBucket[row.bucket] ?? 0) + row.hours);
    }
    for (const row of ticketRows) {
      ticketsByBucket[row.bucket] = (ticketsByBucket[row.bucket] ?? 0) + 1;
    }

    const responseHoursValues = ticketRows
      .map((row) => row.responseHours)
      .filter((value): value is number => value !== null);

    const totalPeriodHours = activityRows.reduce((total, row) => total + row.hours, 0);

    const trend = await this.loadTrend(user, period.periodEnd);
    const paidHoursInPeriod = await this.loadPaidHoursInPeriod(period);

    return {
      periodLabel: period.periodLabel,
      bucketMode: period.bucketMode,
      buckets: period.buckets,
      selectedYear: period.selectedYear,
      selectedMonth: period.selectedMonth,
      availableYears,
      kpis: {
        totalTickets: ticketRows.length,
        concludedTickets: ticketRows.filter((row) =>
          COMPLETED_STATUSES.includes(row.status),
        ).length,
        openTickets: ticketRows.filter(
          (row) => !COMPLETED_STATUSES.includes(row.status),
        ).length,
        totalHours: round2(totalPeriodHours),
        averageHoursPerTicket:
          ticketRows.length > 0 ? round2(totalPeriodHours / ticketRows.length) : 0,
        averageFirstResponseHours:
          responseHoursValues.length > 0
            ? round2(
                responseHoursValues.reduce((total, value) => total + value, 0) /
                  responseHoursValues.length,
              )
            : null,
        ticketsWithActivity: ticketRows.filter((row) => row.responseHours !== null)
          .length,
      },
      backlog,
      byStatus: aggregateByStatus(ticketRows, activityRows),
      byModule: aggregateBy(ticketRows, activityRows, (row) => row.module),
      byTechnician: aggregateTechnicians(ticketRows, activityRows),
      byClient: aggregateBy(ticketRows, activityRows, (row) => row.client),
      trend,
      tickets: ticketRows,
      activities: activityRows,
      hoursByBucket,
      ticketsByBucket,
      accumulatedHours: hoursBank.netAccumulatedHours,
      monthlyHoursAllowance: hoursBank.franchiseHours,
      paidHoursInPeriod,
      cycleStartLabel: hoursBank.cycleStartLabel,
      cycleEndLabel: hoursBank.cycleEndLabel,
      statusMeta: ANALYTICS_STATUS_META,
    };
  }

  // -------------------------------------------------------------------------

  private scopedTicketWhere(user: AuthenticatedUser): Prisma.TicketWhereInput {
    return user.role === 'client' ? { clientId: user.id } : {};
  }

  /**
   * `analytics_dashboard` do legado resolve três visões distintas:
   *   ano + mês → mensal (eixo diário);
   *   só ano    → anual (eixo mensal);
   *   nenhum    → todo o período (eixo mensal, do chamado mais antigo até hoje).
   */
  private async resolvePeriod(
    user: AuthenticatedUser,
    query: AnalyticsQueryDto,
    now: Date,
  ): Promise<ResolvedPeriod> {
    const nowParts = storageToWallClock(now);

    let selectedYear: number | null;
    let selectedMonth: number | null;

    if (query.allPeriods) {
      selectedYear = null;
      selectedMonth = null;
    } else if (query.year === undefined && query.month === undefined) {
      // Sem parâmetros: mês corrente, como o legado.
      selectedYear = nowParts.year;
      selectedMonth = nowParts.month;
    } else {
      selectedYear = query.year ?? nowParts.year;
      selectedMonth = query.month ?? null;
    }

    if (selectedYear !== null && selectedMonth !== null) {
      const [periodStart, periodEnd] = monthPeriodBounds(selectedYear, selectedMonth);
      const daysInMonth = new Date(
        Date.UTC(selectedYear, selectedMonth, 0),
      ).getUTCDate();

      return {
        selectedYear,
        selectedMonth,
        periodStart,
        periodEnd,
        bucketMode: 'day',
        buckets: Array.from({ length: daysInMonth }, (_unused, index) => ({
          key: String(index + 1),
          label: String(index + 1),
        })),
        periodLabel: `Visão de ${monthName(selectedMonth)} de ${selectedYear}`,
      };
    }

    let periodStart: Date;
    let periodEnd: Date;
    let periodLabel: string;

    if (selectedYear !== null) {
      periodStart = wallClockAtMonthStart(selectedYear, 1);
      periodEnd = wallClockAtMonthStart(selectedYear + 1, 1);
      periodLabel = `Visão do ano de ${selectedYear}`;
    } else {
      // Todo o período: do mês do chamado mais antigo até o fim do mês corrente.
      const earliest = await this.prisma.ticket.findFirst({
        where: this.scopedTicketWhere(user),
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });

      if (earliest) {
        const earliestParts = storageToWallClock(earliest.createdAt);
        periodStart = wallClockAtMonthStart(earliestParts.year, earliestParts.month);
      } else {
        periodStart = wallClockAtMonthStart(nowParts.year, 1);
      }
      periodEnd = monthPeriodBounds(nowParts.year, nowParts.month)[1];
      periodLabel = 'Visão de todo o período';
    }

    // Eixo mensal, um bucket por mês do intervalo.
    const buckets: AnalyticsBucket[] = [];
    let cursor = periodStart;
    while (cursor.getTime() < periodEnd.getTime()) {
      const parts = storageToWallClock(cursor);
      const shortLabel = MONTH_SHORT_PT[parts.month - 1];
      buckets.push({
        key: `${parts.year}-${String(parts.month).padStart(2, '0')}`,
        // Na visão de todo o período o legado acrescenta o ano abreviado.
        label:
          selectedYear === null
            ? `${shortLabel}/${String(parts.year).slice(2)}`
            : shortLabel,
      });
      cursor = addMonths(cursor, 1);
    }

    return {
      selectedYear,
      selectedMonth: null,
      periodStart,
      periodEnd,
      bucketMode: 'month',
      buckets,
      periodLabel,
    };
  }

  private async loadPeriodActivities(
    user: AuthenticatedUser,
    periodStart: Date,
    periodEnd: Date,
  ) {
    return this.prisma.activity.findMany({
      where: {
        endedAt: { gt: periodStart },
        startedAt: { lt: periodEnd },
        ...(user.role === 'client' ? { ticket: { clientId: user.id } } : {}),
      },
      select: {
        ticketId: true,
        startedAt: true,
        endedAt: true,
        createdBy: { select: { name: true } },
        ticket: {
          select: {
            status: true,
            client: { select: { name: true } },
            systemModule: { select: { name: true } },
          },
        },
      },
    });
  }

  private async loadAvailableYears(
    user: AuthenticatedUser,
    now: Date,
  ): Promise<number[]> {
    const rows = await this.prisma.ticket.findMany({
      where: this.scopedTicketWhere(user),
      select: { createdAt: true },
    });

    const years = new Set(rows.map((row) => row.createdAt.getUTCFullYear()));
    years.add(storageToWallClock(now).year);
    return Array.from(years).sort((left, right) => right - left);
  }

  /**
   * Backlog do legado: chamados `aberto` ou `em_andamento` em **todo** o
   * histórico do escopo — não apenas no período selecionado.
   */
  private async loadBacklog(user: AuthenticatedUser, now: Date) {
    const where: Prisma.TicketWhereInput = {
      ...this.scopedTicketWhere(user),
      status: { in: BACKLOG_STATUSES },
    };

    const [total, oldest] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findFirst({
        where,
        orderBy: { createdAt: 'asc' },
        select: { id: true, createdAt: true },
      }),
    ]);

    return {
      total,
      oldestDays: oldest
        ? Math.max(
            Math.floor((now.getTime() - oldest.createdAt.getTime()) / MS_PER_DAY),
            0,
          )
        : 0,
      oldestTicketId: oldest?.id ?? null,
    };
  }

  /** Tendência de 12 meses encerrando no período selecionado. */
  private async loadTrend(
    user: AuthenticatedUser,
    periodEnd: Date,
  ): Promise<AnalyticsTrendPoint[]> {
    // O legado ancora em `period_end - 1s` para pegar o último mês do intervalo.
    const anchor = new Date(periodEnd.getTime() - 1000);
    const anchorParts = storageToWallClock(anchor);
    const trendStart = addMonths(
      wallClockAtMonthStart(anchorParts.year, anchorParts.month),
      -11,
    );

    const [tickets, activities] = await Promise.all([
      this.prisma.ticket.findMany({
        where: {
          ...this.scopedTicketWhere(user),
          createdAt: { gte: trendStart, lt: periodEnd },
        },
        select: { createdAt: true },
      }),
      this.prisma.activity.findMany({
        where: {
          endedAt: { gt: trendStart },
          startedAt: { lt: periodEnd },
          ...(user.role === 'client' ? { ticket: { clientId: user.id } } : {}),
        },
        select: { startedAt: true, endedAt: true },
      }),
    ]);

    const ticketCounts = new Map<string, number>();
    for (const ticket of tickets) {
      const key = monthKeyOf(ticket.createdAt);
      ticketCounts.set(key, (ticketCounts.get(key) ?? 0) + 1);
    }

    // Horas fatiadas por mês, como no banco de horas.
    const hourMilliseconds = new Map<string, number>();
    for (const activity of activities) {
      let cursor = new Date(
        Math.max(activity.startedAt.getTime(), trendStart.getTime()),
      );
      const overlapEnd = new Date(
        Math.min(activity.endedAt.getTime(), periodEnd.getTime()),
      );

      while (cursor.getTime() < overlapEnd.getTime()) {
        const parts = storageToWallClock(cursor);
        const monthEnd = monthPeriodBounds(parts.year, parts.month)[1];
        const segmentEnd = new Date(Math.min(overlapEnd.getTime(), monthEnd.getTime()));

        const key = monthKeyOf(cursor);
        hourMilliseconds.set(
          key,
          (hourMilliseconds.get(key) ?? 0) + (segmentEnd.getTime() - cursor.getTime()),
        );
        cursor = segmentEnd;
      }
    }

    return Array.from({ length: 12 }, (_unused, offset) => {
      const monthRef = addMonths(trendStart, offset);
      const parts = storageToWallClock(monthRef);
      const key = `${parts.year}-${String(parts.month).padStart(2, '0')}`;
      return {
        label: `${String(parts.month).padStart(2, '0')}/${String(parts.year).slice(2)}`,
        year: parts.year,
        month: parts.month,
        tickets: ticketCounts.get(key) ?? 0,
        hours: round2((hourMilliseconds.get(key) ?? 0) / MS_PER_HOUR),
      };
    });
  }

  /**
   * Horas pagas no período. Na visão de todo o período o legado **não filtra**
   * por data; nas outras usa `paid_at >= início AND < fim` (exclusivo).
   */
  private async loadPaidHoursInPeriod(period: ResolvedPeriod): Promise<number> {
    const where: Prisma.PaymentRecordWhereInput = {};

    if (period.selectedYear !== null) {
      where.paidAt = {
        gte: toDateOnly(period.periodStart),
        lt: toDateOnly(period.periodEnd),
      };
    }

    const aggregate = await this.prisma.paymentRecord.aggregate({
      where,
      _sum: { paidHours: true },
    });

    return round2(Number(aggregate._sum.paidHours ?? 0));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function monthName(month: number): string {
  return MONTHS_PT[month - 1]?.label ?? String(month);
}

function wallClockAtMonthStart(year: number, month: number): Date {
  return wallClockToStorage({
    year,
    month,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
}

function monthKeyOf(stored: Date): string {
  const parts = storageToWallClock(stored);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

function bucketOf(stored: Date, mode: BucketMode): string {
  const parts = storageToWallClock(stored);
  return mode === 'day'
    ? String(parts.day)
    : `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

/** dd/mm/aaaa HH:MM, como `strftime("%d/%m/%Y %H:%M")` do legado. */
function formatDateTimeLabel(stored: Date): string {
  const parts = storageToWallClock(stored);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(parts.day)}/${pad(parts.month)}/${parts.year} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** Extrai a data pura de um valor de parede, para comparar com `paid_at`. */
function toDateOnly(stored: Date): Date {
  const parts = storageToWallClock(stored);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function aggregateByStatus(
  tickets: AnalyticsTicketRow[],
  activities: AnalyticsActivityRow[],
): CountByKey[] {
  const counts = new Map<string, number>();
  const hours = new Map<string, number>();

  for (const ticket of tickets) {
    counts.set(ticket.status, (counts.get(ticket.status) ?? 0) + 1);
  }
  for (const activity of activities) {
    hours.set(activity.status, (hours.get(activity.status) ?? 0) + activity.hours);
  }

  const keys = new Set([...counts.keys(), ...hours.keys()]);
  return Array.from(keys)
    .map((key) => ({
      key,
      label: ANALYTICS_STATUS_META[key]?.label ?? statusLabel(key),
      count: counts.get(key) ?? 0,
      hours: round2(hours.get(key) ?? 0),
    }))
    .sort(
      (left, right) => right.count - left.count || left.key.localeCompare(right.key),
    );
}

function aggregateBy(
  tickets: AnalyticsTicketRow[],
  activities: AnalyticsActivityRow[],
  pick: (row: AnalyticsTicketRow) => string,
): CountByKey[] {
  const counts = new Map<string, number>();
  const hours = new Map<string, number>();

  for (const ticket of tickets) {
    const key = pick(ticket);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const activity of activities) {
    // As chaves de módulo e cliente têm o mesmo nome nas duas coleções.
    const key = pick({
      module: activity.module,
      client: activity.client,
    } as AnalyticsTicketRow);
    hours.set(key, (hours.get(key) ?? 0) + activity.hours);
  }

  const keys = new Set([...counts.keys(), ...hours.keys()]);
  return Array.from(keys)
    .map((key) => ({
      key,
      label: key,
      count: counts.get(key) ?? 0,
      hours: round2(hours.get(key) ?? 0),
    }))
    .sort(
      (left, right) =>
        right.hours - left.hours ||
        right.count - left.count ||
        left.label.localeCompare(right.label, 'pt-BR'),
    );
}

/**
 * Técnicos: as horas vêm de quem **registrou** a atividade; a contagem de
 * chamados, de quem está **designado**.
 */
function aggregateTechnicians(
  tickets: AnalyticsTicketRow[],
  activities: AnalyticsActivityRow[],
): CountByKey[] {
  const counts = new Map<string, number>();
  const hours = new Map<string, number>();

  for (const ticket of tickets) {
    if (ticket.technician !== '-') {
      counts.set(ticket.technician, (counts.get(ticket.technician) ?? 0) + 1);
    }
  }
  for (const activity of activities) {
    hours.set(
      activity.technician,
      (hours.get(activity.technician) ?? 0) + activity.hours,
    );
  }

  const keys = new Set([...counts.keys(), ...hours.keys()]);
  return Array.from(keys)
    .map((key) => ({
      key,
      label: key,
      count: counts.get(key) ?? 0,
      hours: round2(hours.get(key) ?? 0),
    }))
    .sort(
      (left, right) =>
        right.hours - left.hours || left.label.localeCompare(right.label, 'pt-BR'),
    );
}
