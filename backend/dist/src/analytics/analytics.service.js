"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const legacy_enums_1 = require("../common/domain/legacy-enums");
const legacy_clock_1 = require("../common/time/legacy-clock");
const hours_bank_service_1 = require("../hours-bank/hours-bank.service");
const prisma_service_1 = require("../prisma/prisma.service");
const analytics_types_1 = require("./analytics.types");
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
};
let AnalyticsService = class AnalyticsService {
    constructor(prisma, hoursBank) {
        this.prisma = prisma;
        this.hoursBank = hoursBank;
    }
    async getAnalytics(user, query) {
        const now = (0, legacy_clock_1.instantToWallClockStorage)(new Date());
        const period = await this.resolvePeriod(user, query, now);
        const ticketWhere = this.scopedTicketWhere(user);
        const [periodTickets, periodActivities, availableYears, backlog, hoursBank] = await Promise.all([
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
        const activityRows = [];
        const technicianNamesByTicket = new Map();
        const hoursByTicket = new Map();
        for (const activity of periodActivities) {
            const overlapStart = Math.max(activity.startedAt.getTime(), period.periodStart.getTime());
            const overlapEnd = Math.min(activity.endedAt.getTime(), period.periodEnd.getTime());
            const hours = Math.max(overlapEnd - overlapStart, 0) / MS_PER_HOUR;
            if (hours <= 0)
                continue;
            const technicianName = activity.createdBy?.name ?? 'Técnico não informado';
            const names = technicianNamesByTicket.get(activity.ticketId) ?? new Set();
            names.add(technicianName);
            technicianNamesByTicket.set(activity.ticketId, names);
            hoursByTicket.set(activity.ticketId, (hoursByTicket.get(activity.ticketId) ?? 0) + hours);
            activityRows.push({
                ticketId: activity.ticketId,
                bucket: bucketOf(new Date(overlapStart), period.bucketMode),
                technician: technicianName,
                hours: round2(hours),
                status: activity.ticket.status,
                module: activity.ticket.systemModule?.name ?? 'Sem módulo',
                client: activity.ticket.client?.name ?? '-',
            });
        }
        const ticketRows = periodTickets.map((ticket) => {
            const firstActivity = ticket.activities.reduce((earliest, item) => !earliest || item.startedAt.getTime() < earliest.startedAt.getTime()
                ? item
                : earliest, null);
            const totalHours = ticket.activities.reduce((total, item) => total + Math.max(item.endedAt.getTime() - item.startedAt.getTime(), 0), 0) / MS_PER_HOUR;
            const technicians = new Set(technicianNamesByTicket.get(ticket.id) ?? []);
            if (ticket.technician) {
                technicians.add(ticket.technician.name);
            }
            const isConcluded = COMPLETED_STATUSES.includes(ticket.status);
            return {
                id: ticket.id,
                title: ticket.title,
                status: ticket.status,
                statusLabel: (0, legacy_enums_1.statusLabel)(ticket.status),
                module: ticket.systemModule?.name ?? 'Sem módulo',
                client: ticket.client?.name ?? '-',
                technician: ticket.technician?.name ?? '-',
                technicians: Array.from(technicians).sort((a, b) => a.localeCompare(b, 'pt-BR')),
                bucket: bucketOf(ticket.createdAt, period.bucketMode),
                createdAt: ticket.createdAt.toISOString(),
                createdLabel: formatDateTimeLabel(ticket.createdAt),
                hours: round2(totalHours),
                responseHours: firstActivity
                    ? round2(Math.max(firstActivity.startedAt.getTime() - ticket.createdAt.getTime(), 0) / MS_PER_HOUR)
                    : null,
                ageDays: isConcluded
                    ? null
                    : Math.max(Math.floor((now.getTime() - ticket.createdAt.getTime()) / MS_PER_DAY), 0),
            };
        });
        const hoursByBucket = {};
        const ticketsByBucket = {};
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
            .filter((value) => value !== null);
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
                concludedTickets: ticketRows.filter((row) => COMPLETED_STATUSES.includes(row.status)).length,
                openTickets: ticketRows.filter((row) => !COMPLETED_STATUSES.includes(row.status)).length,
                totalHours: round2(totalPeriodHours),
                averageHoursPerTicket: ticketRows.length > 0 ? round2(totalPeriodHours / ticketRows.length) : 0,
                averageFirstResponseHours: responseHoursValues.length > 0
                    ? round2(responseHoursValues.reduce((total, value) => total + value, 0) /
                        responseHoursValues.length)
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
            statusMeta: analytics_types_1.ANALYTICS_STATUS_META,
        };
    }
    scopedTicketWhere(user) {
        return user.role === 'client' ? { clientId: user.id } : {};
    }
    async resolvePeriod(user, query, now) {
        const nowParts = (0, legacy_clock_1.storageToWallClock)(now);
        let selectedYear;
        let selectedMonth;
        if (query.allPeriods) {
            selectedYear = null;
            selectedMonth = null;
        }
        else if (query.year === undefined && query.month === undefined) {
            selectedYear = nowParts.year;
            selectedMonth = nowParts.month;
        }
        else {
            selectedYear = query.year ?? nowParts.year;
            selectedMonth = query.month ?? null;
        }
        if (selectedYear !== null && selectedMonth !== null) {
            const [periodStart, periodEnd] = (0, legacy_clock_1.monthPeriodBounds)(selectedYear, selectedMonth);
            const daysInMonth = new Date(Date.UTC(selectedYear, selectedMonth, 0)).getUTCDate();
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
        let periodStart;
        let periodEnd;
        let periodLabel;
        if (selectedYear !== null) {
            periodStart = wallClockAtMonthStart(selectedYear, 1);
            periodEnd = wallClockAtMonthStart(selectedYear + 1, 1);
            periodLabel = `Visão do ano de ${selectedYear}`;
        }
        else {
            const earliest = await this.prisma.ticket.findFirst({
                where: this.scopedTicketWhere(user),
                orderBy: { createdAt: 'asc' },
                select: { createdAt: true },
            });
            if (earliest) {
                const earliestParts = (0, legacy_clock_1.storageToWallClock)(earliest.createdAt);
                periodStart = wallClockAtMonthStart(earliestParts.year, earliestParts.month);
            }
            else {
                periodStart = wallClockAtMonthStart(nowParts.year, 1);
            }
            periodEnd = (0, legacy_clock_1.monthPeriodBounds)(nowParts.year, nowParts.month)[1];
            periodLabel = 'Visão de todo o período';
        }
        const buckets = [];
        let cursor = periodStart;
        while (cursor.getTime() < periodEnd.getTime()) {
            const parts = (0, legacy_clock_1.storageToWallClock)(cursor);
            const shortLabel = analytics_types_1.MONTH_SHORT_PT[parts.month - 1];
            buckets.push({
                key: `${parts.year}-${String(parts.month).padStart(2, '0')}`,
                label: selectedYear === null
                    ? `${shortLabel}/${String(parts.year).slice(2)}`
                    : shortLabel,
            });
            cursor = (0, legacy_clock_1.addMonths)(cursor, 1);
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
    async loadPeriodActivities(user, periodStart, periodEnd) {
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
    async loadAvailableYears(user, now) {
        const rows = await this.prisma.ticket.findMany({
            where: this.scopedTicketWhere(user),
            select: { createdAt: true },
        });
        const years = new Set(rows.map((row) => row.createdAt.getUTCFullYear()));
        years.add((0, legacy_clock_1.storageToWallClock)(now).year);
        return Array.from(years).sort((left, right) => right - left);
    }
    async loadBacklog(user, now) {
        const where = {
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
                ? Math.max(Math.floor((now.getTime() - oldest.createdAt.getTime()) / MS_PER_DAY), 0)
                : 0,
            oldestTicketId: oldest?.id ?? null,
        };
    }
    async loadTrend(user, periodEnd) {
        const anchor = new Date(periodEnd.getTime() - 1000);
        const anchorParts = (0, legacy_clock_1.storageToWallClock)(anchor);
        const trendStart = (0, legacy_clock_1.addMonths)(wallClockAtMonthStart(anchorParts.year, anchorParts.month), -11);
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
        const ticketCounts = new Map();
        for (const ticket of tickets) {
            const key = monthKeyOf(ticket.createdAt);
            ticketCounts.set(key, (ticketCounts.get(key) ?? 0) + 1);
        }
        const hourMilliseconds = new Map();
        for (const activity of activities) {
            let cursor = new Date(Math.max(activity.startedAt.getTime(), trendStart.getTime()));
            const overlapEnd = new Date(Math.min(activity.endedAt.getTime(), periodEnd.getTime()));
            while (cursor.getTime() < overlapEnd.getTime()) {
                const parts = (0, legacy_clock_1.storageToWallClock)(cursor);
                const monthEnd = (0, legacy_clock_1.monthPeriodBounds)(parts.year, parts.month)[1];
                const segmentEnd = new Date(Math.min(overlapEnd.getTime(), monthEnd.getTime()));
                const key = monthKeyOf(cursor);
                hourMilliseconds.set(key, (hourMilliseconds.get(key) ?? 0) + (segmentEnd.getTime() - cursor.getTime()));
                cursor = segmentEnd;
            }
        }
        return Array.from({ length: 12 }, (_unused, offset) => {
            const monthRef = (0, legacy_clock_1.addMonths)(trendStart, offset);
            const parts = (0, legacy_clock_1.storageToWallClock)(monthRef);
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
    async loadPaidHoursInPeriod(period) {
        const where = {};
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
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        hours_bank_service_1.HoursBankService])
], AnalyticsService);
function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function monthName(month) {
    return analytics_types_1.MONTHS_PT[month - 1]?.label ?? String(month);
}
function wallClockAtMonthStart(year, month) {
    return (0, legacy_clock_1.wallClockToStorage)({
        year,
        month,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
    });
}
function monthKeyOf(stored) {
    const parts = (0, legacy_clock_1.storageToWallClock)(stored);
    return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}
function bucketOf(stored, mode) {
    const parts = (0, legacy_clock_1.storageToWallClock)(stored);
    return mode === 'day'
        ? String(parts.day)
        : `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}
function formatDateTimeLabel(stored) {
    const parts = (0, legacy_clock_1.storageToWallClock)(stored);
    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(parts.day)}/${pad(parts.month)}/${parts.year} ${pad(parts.hour)}:${pad(parts.minute)}`;
}
function toDateOnly(stored) {
    const parts = (0, legacy_clock_1.storageToWallClock)(stored);
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}
function aggregateByStatus(tickets, activities) {
    const counts = new Map();
    const hours = new Map();
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
        label: analytics_types_1.ANALYTICS_STATUS_META[key]?.label ?? (0, legacy_enums_1.statusLabel)(key),
        count: counts.get(key) ?? 0,
        hours: round2(hours.get(key) ?? 0),
    }))
        .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}
function aggregateBy(tickets, activities, pick) {
    const counts = new Map();
    const hours = new Map();
    for (const ticket of tickets) {
        const key = pick(ticket);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const activity of activities) {
        const key = pick({
            module: activity.module,
            client: activity.client,
        });
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
        .sort((left, right) => right.hours - left.hours ||
        right.count - left.count ||
        left.label.localeCompare(right.label, 'pt-BR'));
}
function aggregateTechnicians(tickets, activities) {
    const counts = new Map();
    const hours = new Map();
    for (const ticket of tickets) {
        if (ticket.technician !== '-') {
            counts.set(ticket.technician, (counts.get(ticket.technician) ?? 0) + 1);
        }
    }
    for (const activity of activities) {
        hours.set(activity.technician, (hours.get(activity.technician) ?? 0) + activity.hours);
    }
    const keys = new Set([...counts.keys(), ...hours.keys()]);
    return Array.from(keys)
        .map((key) => ({
        key,
        label: key,
        count: counts.get(key) ?? 0,
        hours: round2(hours.get(key) ?? 0),
    }))
        .sort((left, right) => right.hours - left.hours || left.label.localeCompare(right.label, 'pt-BR'));
}
//# sourceMappingURL=analytics.service.js.map