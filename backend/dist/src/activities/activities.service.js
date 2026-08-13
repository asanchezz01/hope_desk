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
exports.ActivitiesService = void 0;
const common_1 = require("@nestjs/common");
const deletion_window_1 = require("../common/domain/deletion-window");
const domain_events_1 = require("../common/events/domain-events");
const domain_events_service_1 = require("../common/events/domain-events.service");
const legacy_clock_1 = require("../common/time/legacy-clock");
const prisma_service_1 = require("../prisma/prisma.service");
const ticket_policy_1 = require("../tickets/ticket.policy");
const activity_period_1 = require("./activity-period");
const activity_policy_1 = require("./activity.policy");
const ACTIVITY_INCLUDE = {
    createdBy: { select: { id: true, name: true } },
};
const INVALID_DATES_MESSAGE = 'Datas inválidas. Use data e hora válidas.';
let ActivitiesService = class ActivitiesService {
    constructor(prisma, events) {
        this.prisma = prisma;
        this.events = events;
    }
    async list(user, ticketId) {
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
    async create(user, ticketId, dto) {
        if (!(0, activity_policy_1.canCreateActivity)(user)) {
            throw new common_1.ForbiddenException('Somente técnicos podem registrar atividades.');
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
                createdById: user.id,
            },
            include: ACTIVITY_INCLUDE,
        });
        await this.events.publish(domain_events_1.ACTIVITY_CREATED, {
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
    async update(user, ticketId, activityId, dto) {
        if (!(0, activity_policy_1.canCreateActivity)(user)) {
            throw new common_1.ForbiddenException('Somente técnicos podem editar atividades.');
        }
        const existing = await this.loadActivityOfTicket(ticketId, activityId);
        if (!(0, activity_policy_1.canEditActivity)(user, existing)) {
            throw new common_1.ForbiddenException('Você só pode editar atividades lançadas por você.');
        }
        const { startedAt, endedAt } = this.parsePeriod(dto.startedAt, dto.endedAt);
        this.assertValidPeriod(startedAt, endedAt);
        await this.assertNoConflict(user.id, startedAt, endedAt, existing.id);
        const activity = await this.prisma.activity.update({
            where: { id: activityId },
            data: { notes: dto.notes, startedAt, endedAt },
            include: ACTIVITY_INCLUDE,
        });
        return this.toResponse(user, activity);
    }
    async remove(user, ticketId, activityId) {
        if (!(0, activity_policy_1.canCreateActivity)(user)) {
            throw new common_1.ForbiddenException('Somente técnicos podem excluir atividades.');
        }
        const existing = await this.loadActivityOfTicket(ticketId, activityId);
        if (!(0, activity_policy_1.canDeleteActivity)(user, existing)) {
            throw new common_1.ForbiddenException(deletion_window_1.ACTIVITY_DELETE_WINDOW_MESSAGE);
        }
        await this.prisma.activity.delete({ where: { id: activityId } });
    }
    parsePeriod(startedAtRaw, endedAtRaw) {
        try {
            return {
                startedAt: (0, legacy_clock_1.parseWallClockInput)(startedAtRaw),
                endedAt: (0, legacy_clock_1.parseWallClockInput)(endedAtRaw),
            };
        }
        catch {
            throw new common_1.BadRequestException(INVALID_DATES_MESSAGE);
        }
    }
    assertValidPeriod(startedAt, endedAt) {
        const error = (0, activity_period_1.validateActivityPeriod)(startedAt, endedAt);
        if (error) {
            throw new common_1.BadRequestException(error);
        }
    }
    async assertNoConflict(technicianId, startedAt, endedAt, excludeActivityId) {
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
        const conflict = (0, activity_period_1.findActivityConflict)(candidates, startedAt, endedAt, excludeActivityId);
        if (conflict) {
            throw new common_1.ConflictException('Conflito de horário: já existe uma atividade sua nesse período ' +
                `(${(0, legacy_clock_1.formatWallClockPtBr)(conflict.startedAt)} ` +
                `até ${(0, legacy_clock_1.formatWallClockPtBr)(conflict.endedAt)}).`);
        }
    }
    async loadVisibleTicket(user, ticketId) {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id: ticketId },
            select: { id: true, clientId: true },
        });
        if (!ticket || !(0, ticket_policy_1.canViewTicket)(user, ticket)) {
            throw new common_1.NotFoundException('Chamado não encontrado.');
        }
        return ticket;
    }
    async loadTicketForActivity(ticketId) {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id: ticketId },
            select: {
                id: true,
                title: true,
                client: { select: { id: true, name: true, email: true } },
            },
        });
        if (!ticket) {
            throw new common_1.NotFoundException('Chamado não encontrado.');
        }
        return ticket;
    }
    async loadActivityOfTicket(ticketId, activityId) {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id: ticketId },
            select: { id: true },
        });
        if (!ticket) {
            throw new common_1.NotFoundException('Chamado não encontrado.');
        }
        const activity = await this.prisma.activity.findFirst({
            where: { id: activityId, ticketId },
        });
        if (!activity) {
            throw new common_1.NotFoundException('Atividade não encontrada.');
        }
        return activity;
    }
    toResponse(user, activity) {
        return {
            id: activity.id,
            ticketId: activity.ticketId,
            notes: activity.notes,
            startedAt: (0, legacy_clock_1.formatWallClockIso)(activity.startedAt),
            endedAt: (0, legacy_clock_1.formatWallClockIso)(activity.endedAt),
            startedLabel: (0, legacy_clock_1.formatWallClockPtBr)(activity.startedAt),
            endedLabel: (0, legacy_clock_1.formatWallClockPtBr)(activity.endedAt),
            durationHours: (0, activity_period_1.activityDurationHours)(activity.startedAt, activity.endedAt),
            createdBy: activity.createdBy,
            canEdit: (0, activity_policy_1.canEditActivity)(user, activity),
            canDelete: (0, activity_policy_1.canDeleteActivity)(user, activity),
        };
    }
};
exports.ActivitiesService = ActivitiesService;
exports.ActivitiesService = ActivitiesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        domain_events_service_1.DomainEventsService])
], ActivitiesService);
function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
//# sourceMappingURL=activities.service.js.map