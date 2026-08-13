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
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const legacy_enums_1 = require("../common/domain/legacy-enums");
const legacy_clock_1 = require("../common/time/legacy-clock");
const parameters_service_1 = require("../parameters/parameters.service");
const prisma_service_1 = require("../prisma/prisma.service");
const MS_PER_HOUR = 3_600_000;
let ReportsService = class ReportsService {
    constructor(prisma, parameters) {
        this.prisma = prisma;
        this.parameters = parameters;
    }
    async buildActivityReport(user, startRaw, endRaw) {
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
        const grouped = new Map();
        const technicianTotals = new Map();
        for (const activity of activities) {
            const ticket = activity.ticket;
            const overlapStart = new Date(Math.max(activity.startedAt.getTime(), periodStart.getTime()));
            const overlapEnd = new Date(Math.min(activity.endedAt.getTime(), periodEnd.getTime()));
            const overlapHours = Math.max(overlapEnd.getTime() - overlapStart.getTime(), 0) / MS_PER_HOUR;
            if (overlapHours <= 0)
                continue;
            let ticketRow = grouped.get(ticket.id);
            if (!ticketRow) {
                ticketRow = {
                    ticketId: ticket.id,
                    title: ticket.title,
                    description: ticket.description,
                    status: (0, legacy_enums_1.statusLabel)(ticket.status),
                    clientName: ticket.client?.name ?? '-',
                    assignedTechnician: ticket.technician?.name ?? '-',
                    moduleName: ticket.systemModule?.name ?? '-',
                    createdAt: ticket.createdAt.toISOString(),
                    createdLabel: (0, legacy_clock_1.formatWallClockPtBr)(ticket.createdAt),
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
                startedLabel: (0, legacy_clock_1.formatWallClockPtBr)(activity.startedAt),
                endedLabel: (0, legacy_clock_1.formatWallClockPtBr)(activity.endedAt),
                technicianName,
                notes: activity.notes,
                hours: round2(overlapHours),
            });
            ticketRow.totalHours += overlapHours;
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
            .sort((left, right) => left.technicianName
            .toLowerCase()
            .localeCompare(right.technicianName.toLowerCase(), 'pt-BR'));
        return {
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            periodStartLabel: formatDayLabel(periodStart),
            periodEndLabel: formatDayLabel(new Date(periodEnd.getTime() - 1000)),
            company,
            tickets,
            totalsByTechnician,
            totalHours: round2(tickets.reduce((total, row) => total + row.totalHours, 0)),
        };
    }
    async buildServicesReport(user, year, month) {
        const nowParts = (0, legacy_clock_1.storageToWallClock)((0, legacy_clock_1.instantToWallClockStorage)(new Date()));
        const selectedYear = year ?? nowParts.year;
        const selectedMonth = month ?? nowParts.month;
        const [periodStart, periodEnd] = (0, legacy_clock_1.monthPeriodBounds)(selectedYear, selectedMonth);
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
        const rows = [];
        for (const activity of activities) {
            const ticket = activity.ticket;
            const overlapStart = Math.max(activity.startedAt.getTime(), periodStart.getTime());
            const overlapEnd = Math.min(activity.endedAt.getTime(), periodEnd.getTime());
            const overlapHours = Math.max(overlapEnd - overlapStart, 0) / MS_PER_HOUR;
            if (overlapHours <= 0)
                continue;
            const activityEndForPeriod = new Date(Math.min(activity.endedAt.getTime(), periodEndDisplay.getTime()));
            const technicianName = activity.createdBy?.name ?? ticket.technician?.name ?? '-';
            rows.push({
                ticketId: ticket.id,
                lastActivityAt: activityEndForPeriod.toISOString(),
                lastActivityLabel: (0, legacy_clock_1.formatWallClockPtBr)(activityEndForPeriod),
                title: ticket.title,
                service: activity.notes,
                status: (0, legacy_enums_1.statusLabel)(ticket.status),
                clientName: ticket.client?.name ?? '-',
                technicianName,
                hours: round2(overlapHours),
            });
        }
        rows.sort((left, right) => new Date(right.lastActivityAt).getTime() -
            new Date(left.lastActivityAt).getTime());
        return {
            year: selectedYear,
            month: selectedMonth,
            periodLabel: `${String(selectedMonth).padStart(2, '0')}/${selectedYear}`,
            company,
            rows,
            totalHours: round2(rows.reduce((total, row) => total + row.hours, 0)),
        };
    }
    async loadCompanyHeader() {
        const values = await this.parameters.getMany([
            'company_name',
            'company_address',
            'company_logo',
        ]);
        return {
            companyName: values.company_name,
            companyAddress: values.company_address,
            companyLogo: values.company_logo,
        };
    }
    resolveDatePeriod(startRaw, endRaw) {
        const nowParts = (0, legacy_clock_1.storageToWallClock)((0, legacy_clock_1.instantToWallClockStorage)(new Date()));
        const start = startRaw
            ? this.parseDay(startRaw, 'data inicial')
            : (0, legacy_clock_1.wallClockToStorage)({
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
            : (0, legacy_clock_1.wallClockToStorage)({
                year: nowParts.year,
                month: nowParts.month,
                day: nowParts.day,
                hour: 0,
                minute: 0,
                second: 0,
                millisecond: 0,
            });
        if (endDay.getTime() < start.getTime()) {
            throw new common_1.BadRequestException('A data inicial não pode ser posterior à data final.');
        }
        const periodEnd = new Date(endDay.getTime() + 86_400_000);
        return { periodStart: start, periodEnd };
    }
    parseDay(raw, fieldName) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
            throw new common_1.BadRequestException(`Informe uma ${fieldName} válida (AAAA-MM-DD).`);
        }
        try {
            return (0, legacy_clock_1.parseWallClockInput)(`${raw.trim()}T00:00:00`);
        }
        catch {
            throw new common_1.BadRequestException(`Informe uma ${fieldName} válida (AAAA-MM-DD).`);
        }
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        parameters_service_1.ParametersService])
], ReportsService);
function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function formatDayLabel(stored) {
    const parts = (0, legacy_clock_1.storageToWallClock)(stored);
    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(parts.day)}/${pad(parts.month)}/${parts.year}`;
}
//# sourceMappingURL=reports.service.js.map