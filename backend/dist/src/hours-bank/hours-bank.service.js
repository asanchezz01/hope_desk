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
exports.HoursBankService = void 0;
const common_1 = require("@nestjs/common");
const legacy_clock_1 = require("../common/time/legacy-clock");
const parameters_service_1 = require("../parameters/parameters.service");
const prisma_service_1 = require("../prisma/prisma.service");
const hours_bank_calculator_1 = require("./hours-bank.calculator");
let HoursBankService = class HoursBankService {
    constructor(prisma, parameters) {
        this.prisma = prisma;
        this.parameters = parameters;
    }
    async getHoursBank(user, query) {
        const reference = this.resolveReference(query.reference);
        const [parameterValues, activities, payments] = await Promise.all([
            this.parameters.getMany(['monthly_hours_allowance', 'hours_bank_closing_date']),
            this.loadActivitiesForUser(user),
            this.loadPayments(),
        ]);
        const result = (0, hours_bank_calculator_1.calculateHoursBank)({
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
            cycleStart: (0, legacy_clock_1.formatWallClockIso)(result.cycleStart),
            cycleEnd: (0, legacy_clock_1.formatWallClockIso)(result.cycleEnd),
            cycleStartLabel: formatDayLabel(result.cycleStart),
            cycleEndLabel: formatDayLabel(result.cycleEnd),
            monthlyBreakdown: result.monthlyBreakdown,
            reference: (0, legacy_clock_1.formatWallClockIso)(reference),
        };
    }
    async getMonthlySummary(user, query) {
        const nowParts = (0, legacy_clock_1.storageToWallClock)(this.resolveReference(query.reference));
        const year = query.year ?? nowParts.year;
        const month = query.month ?? nowParts.month;
        const [periodStart, periodEnd] = (0, legacy_clock_1.monthPeriodBounds)(year, month);
        const [activities, payments] = await Promise.all([
            this.loadActivitiesForUser(user, { periodStart, periodEnd }),
            this.loadPayments(),
        ]);
        const periodActivityHours = sumClippedHours(activities, periodStart, periodEnd);
        const externalActivities = await this.loadExternalTicketActivities(user, year, month, periodStart, periodEnd);
        const externalTicketActivityHours = sumClippedHours(externalActivities, periodStart, periodEnd);
        return {
            year,
            month,
            periodActivityHours: round2(periodActivityHours),
            externalTicketActivityHours: round2(externalTicketActivityHours),
            paidHoursInMonth: (0, hours_bank_calculator_1.calculatePaidHoursForMonth)(payments, year, month),
        };
    }
    async loadActivitiesForUser(user, period) {
        const where = {};
        if (user.role === 'client') {
            where.ticket = { clientId: user.id };
        }
        if (period) {
            where.endedAt = { gt: period.periodStart };
            where.startedAt = { lt: period.periodEnd };
        }
        return this.prisma.activity.findMany({
            where,
            select: { startedAt: true, endedAt: true },
        });
    }
    async loadExternalTicketActivities(user, year, month, periodStart, periodEnd) {
        const where = {
            endedAt: { gt: periodStart },
            startedAt: { lt: periodEnd },
            ticket: {
                NOT: {
                    createdAt: {
                        gte: new Date(Date.UTC(year, month - 1, 1)),
                        lt: month === 12
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
    async loadPayments() {
        return this.prisma.paymentRecord.findMany({
            select: { paidAt: true, paidHours: true },
        });
    }
    resolveReference(raw) {
        if (!raw) {
            return (0, legacy_clock_1.instantToWallClockStorage)(new Date());
        }
        try {
            return (0, legacy_clock_1.parseWallClockInput)(raw);
        }
        catch (error) {
            throw new common_1.BadRequestException(`Referência inválida: ${error.message}`);
        }
    }
};
exports.HoursBankService = HoursBankService;
exports.HoursBankService = HoursBankService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        parameters_service_1.ParametersService])
], HoursBankService);
const MS_PER_HOUR = 3_600_000;
function sumClippedHours(activities, windowStart, windowEnd) {
    let milliseconds = 0;
    for (const activity of activities) {
        const start = Math.max(activity.startedAt.getTime(), windowStart.getTime());
        const end = Math.min(activity.endedAt.getTime(), windowEnd.getTime());
        milliseconds += Math.max(end - start, 0);
    }
    return milliseconds / MS_PER_HOUR;
}
function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function formatDayLabel(stored) {
    const parts = (0, legacy_clock_1.storageToWallClock)(stored);
    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(parts.day)}/${pad(parts.month)}/${parts.year}`;
}
//# sourceMappingURL=hours-bank.service.js.map