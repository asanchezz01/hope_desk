import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { statusLabel } from '../common/domain/legacy-enums';
import {
  formatWallClockPtBr,
  instantToWallClockStorage,
  monthPeriodBounds,
  parseWallClockInput,
  storageToWallClock,
  wallClockToStorage,
} from '../common/time/legacy-clock';
import { ParametersService } from '../parameters/parameters.service';
import { PrismaService } from '../prisma/prisma.service';

const MS_PER_HOUR = 3_600_000;

export interface ReportCompanyHeader {
  companyName: string;
  companyAddress: string;
  companyLogo: string;
}

export interface ActivityReportActivityRow {
  startedAt: string;
  endedAt: string;
  /** Início recortado no período. */
  periodStartedAt: string;
  /** Fim recortado no período. */
  periodEndedAt: string;
  startedLabel: string;
  endedLabel: string;
  technicianName: string;
  notes: string;
  /** Horas recortadas no período. */
  hours: number;
}

export interface ActivityReportTicketRow {
  ticketId: number;
  title: string;
  description: string;
  status: string;
  clientName: string;
  assignedTechnician: string;
  moduleName: string;
  createdAt: string;
  createdLabel: string;
  totalHours: number;
  activities: ActivityReportActivityRow[];
}

export interface TechnicianTotal {
  technicianName: string;
  hours: number;
}

export interface ActivityReport {
  periodStart: string;
  periodEnd: string;
  periodStartLabel: string;
  periodEndLabel: string;
  company: ReportCompanyHeader;
  tickets: ActivityReportTicketRow[];
  totalsByTechnician: TechnicianTotal[];
  totalHours: number;
}

export interface ServicesReportRow {
  ticketId: number;
  lastActivityAt: string;
  lastActivityLabel: string;
  title: string;
  service: string;
  status: string;
  clientName: string;
  technicianName: string;
  hours: number;
}

export interface ServicesReport {
  year: number;
  month: number;
  periodLabel: string;
  company: ReportCompanyHeader;
  rows: ServicesReportRow[];
  totalHours: number;
}

/**
 * Relatórios.
 *
 * Reproduz `build_activity_report` e `build_services_report_rows` do legado,
 * incluindo o **recorte proporcional** das atividades pelo período: uma
 * atividade que atravessa a fronteira entra apenas com a fração dentro dela.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parameters: ParametersService,
  ) {}

  /**
   * `build_activity_report`: atividades agrupadas por chamado, com totais por
   * técnico. Ordenação do legado: chamado ASC, atividade ASC.
   */
  async buildActivityReport(
    user: AuthenticatedUser,
    startRaw: string | undefined,
    endRaw: string | undefined,
  ): Promise<ActivityReport> {
    const { periodStart, periodEnd } = this.resolveDatePeriod(startRaw, endRaw);

    const [company, activities] = await Promise.all([
      this.loadCompanyHeader(),
      this.prisma.activity.findMany({
        where: {
          endedAt: { gt: periodStart },
          startedAt: { lt: periodEnd },
          ...(user.role === 'client' ? { ticket: { clientId: user.id } } : {}),
        },
        orderBy: [{ ticketId: 'asc' }, { startedAt: 'asc' }],
        include: {
          createdBy: { select: { id: true, name: true } },
          ticket: {
            include: {
              client: { select: { name: true } },
              technician: { select: { name: true } },
              systemModule: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const grouped = new Map<number, ActivityReportTicketRow>();
    const technicianTotals = new Map<number, TechnicianTotal>();

    for (const activity of activities) {
      const ticket = activity.ticket;

      const overlapStart = new Date(
        Math.max(activity.startedAt.getTime(), periodStart.getTime()),
      );
      const overlapEnd = new Date(
        Math.min(activity.endedAt.getTime(), periodEnd.getTime()),
      );
      const overlapHours =
        Math.max(overlapEnd.getTime() - overlapStart.getTime(), 0) / MS_PER_HOUR;
      if (overlapHours <= 0) continue;

      let ticketRow = grouped.get(ticket.id);
      if (!ticketRow) {
        ticketRow = {
          ticketId: ticket.id,
          title: ticket.title,
          description: ticket.description,
          status: statusLabel(ticket.status),
          clientName: ticket.client?.name ?? '-',
          assignedTechnician: ticket.technician?.name ?? '-',
          moduleName: ticket.systemModule?.name ?? '-',
          createdAt: ticket.createdAt.toISOString(),
          createdLabel: formatWallClockPtBr(ticket.createdAt),
          totalHours: 0,
          activities: [],
        };
        grouped.set(ticket.id, ticketRow);
      }

      const technicianName = activity.createdBy?.name ?? 'Técnico não informado';

      ticketRow.activities.push({
        startedAt: activity.startedAt.toISOString(),
        endedAt: activity.endedAt.toISOString(),
        periodStartedAt: overlapStart.toISOString(),
        periodEndedAt: overlapEnd.toISOString(),
        startedLabel: formatWallClockPtBr(activity.startedAt),
        endedLabel: formatWallClockPtBr(activity.endedAt),
        technicianName,
        notes: activity.notes,
        hours: round2(overlapHours),
      });
      ticketRow.totalHours += overlapHours;

      // Técnico ausente cai na chave 0, como `technician.id if technician else 0`.
      const technicianKey = activity.createdBy?.id ?? 0;
      const existing = technicianTotals.get(technicianKey) ?? {
        technicianName,
        hours: 0,
      };
      existing.hours += overlapHours;
      technicianTotals.set(technicianKey, existing);
    }

    const tickets = Array.from(grouped.values())
      .sort((left, right) => left.ticketId - right.ticketId)
      .map((ticket) => ({ ...ticket, totalHours: round2(ticket.totalHours) }));

    const totalsByTechnician = Array.from(technicianTotals.values())
      .map((item) => ({ ...item, hours: round2(item.hours) }))
      .sort((left, right) =>
        left.technicianName
          .toLowerCase()
          .localeCompare(right.technicianName.toLowerCase(), 'pt-BR'),
      );

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      periodStartLabel: formatDayLabel(periodStart),
      // O legado exibe o último dia INCLUSIVO do intervalo.
      periodEndLabel: formatDayLabel(new Date(periodEnd.getTime() - 1000)),
      company,
      tickets,
      totalsByTechnician,
      // Soma dos totais já arredondados, como o legado.
      totalHours: round2(tickets.reduce((total, row) => total + row.totalHours, 0)),
    };
  }

  /**
   * `build_services_report_rows`: uma linha por atividade, ordenada pelo fim da
   * atividade em ordem decrescente.
   */
  async buildServicesReport(
    user: AuthenticatedUser,
    year: number | undefined,
    month: number | undefined,
  ): Promise<ServicesReport> {
    const nowParts = storageToWallClock(instantToWallClockStorage(new Date()));
    const selectedYear = year ?? nowParts.year;
    const selectedMonth = month ?? nowParts.month;

    const [periodStart, periodEnd] = monthPeriodBounds(selectedYear, selectedMonth);
    // `period_end_display = period_end - 1s` do legado.
    const periodEndDisplay = new Date(periodEnd.getTime() - 1000);

    const [company, activities] = await Promise.all([
      this.loadCompanyHeader(),
      this.prisma.activity.findMany({
        where: {
          endedAt: { gt: periodStart },
          startedAt: { lt: periodEnd },
          ...(user.role === 'client' ? { ticket: { clientId: user.id } } : {}),
        },
        orderBy: { endedAt: 'desc' },
        include: {
          createdBy: { select: { name: true } },
          ticket: {
            include: {
              client: { select: { name: true } },
              technician: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const rows: ServicesReportRow[] = [];

    for (const activity of activities) {
      const ticket = activity.ticket;

      const overlapStart = Math.max(
        activity.startedAt.getTime(),
        periodStart.getTime(),
      );
      const overlapEnd = Math.min(activity.endedAt.getTime(), periodEnd.getTime());
      const overlapHours = Math.max(overlapEnd - overlapStart, 0) / MS_PER_HOUR;
      if (overlapHours <= 0) continue;

      const activityEndForPeriod = new Date(
        Math.min(activity.endedAt.getTime(), periodEndDisplay.getTime()),
      );

      // O legado usa o autor da atividade e cai para o técnico do chamado.
      const technicianName = activity.createdBy?.name ?? ticket.technician?.name ?? '-';

      rows.push({
        ticketId: ticket.id,
        lastActivityAt: activityEndForPeriod.toISOString(),
        lastActivityLabel: formatWallClockPtBr(activityEndForPeriod),
        title: ticket.title,
        service: activity.notes,
        status: statusLabel(ticket.status),
        clientName: ticket.client?.name ?? '-',
        technicianName,
        hours: round2(overlapHours),
      });
    }

    rows.sort(
      (left, right) =>
        new Date(right.lastActivityAt).getTime() -
        new Date(left.lastActivityAt).getTime(),
    );

    return {
      year: selectedYear,
      month: selectedMonth,
      periodLabel: `${String(selectedMonth).padStart(2, '0')}/${selectedYear}`,
      company,
      rows,
      totalHours: round2(rows.reduce((total, row) => total + row.hours, 0)),
    };
  }

  private async loadCompanyHeader(): Promise<ReportCompanyHeader> {
    const values = await this.parameters.getMany([
      'company_name',
      'company_address',
      'company_logo',
    ]);
    return {
      companyName: values.company_name,
      companyAddress: values.company_address,
      // Resolve o nome do arquivo (gravado pelo upload) dentro da pasta de
      // logos para pdfkit abrir o caminho local; URL/caminho inexistente -> ''.
      companyLogo: this.parameters.resolveLogoPath(values.company_logo) ?? '',
    };
  }

  /**
   * `resolve_date_period` do legado: intervalo de datas em hora de parede, com
   * o fim **inclusivo** (o dia final entra inteiro).
   */
  private resolveDatePeriod(
    startRaw: string | undefined,
    endRaw: string | undefined,
  ): { periodStart: Date; periodEnd: Date } {
    const nowParts = storageToWallClock(instantToWallClockStorage(new Date()));

    const start = startRaw
      ? this.parseDay(startRaw, 'data inicial')
      : wallClockToStorage({
          year: nowParts.year,
          month: nowParts.month,
          day: 1,
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0,
        });

    const endDay = endRaw
      ? this.parseDay(endRaw, 'data final')
      : wallClockToStorage({
          year: nowParts.year,
          month: nowParts.month,
          day: nowParts.day,
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0,
        });

    if (endDay.getTime() < start.getTime()) {
      throw new BadRequestException(
        'A data inicial não pode ser posterior à data final.',
      );
    }

    // Fim exclusivo = dia final + 1 dia, para que o dia final entre inteiro.
    const periodEnd = new Date(endDay.getTime() + 86_400_000);
    return { periodStart: start, periodEnd };
  }

  private parseDay(raw: string, fieldName: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
      throw new BadRequestException(`Informe uma ${fieldName} válida (AAAA-MM-DD).`);
    }
    try {
      return parseWallClockInput(`${raw.trim()}T00:00:00`);
    } catch {
      throw new BadRequestException(`Informe uma ${fieldName} válida (AAAA-MM-DD).`);
    }
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatDayLabel(stored: Date): string {
  const parts = storageToWallClock(stored);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(parts.day)}/${pad(parts.month)}/${parts.year}`;
}

/** Reexportado para o gerador de PDF. */
export type { Prisma };
