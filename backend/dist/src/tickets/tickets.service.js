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
exports.TicketsService = void 0;
const common_1 = require("@nestjs/common");
const deletion_window_1 = require("../common/domain/deletion-window");
const legacy_enums_1 = require("../common/domain/legacy-enums");
const domain_events_1 = require("../common/events/domain-events");
const domain_events_service_1 = require("../common/events/domain-events.service");
const legacy_clock_1 = require("../common/time/legacy-clock");
const prisma_service_1 = require("../prisma/prisma.service");
const ticket_dto_1 = require("./dto/ticket.dto");
const ticket_policy_1 = require("./ticket.policy");
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const COMPLETED_STATUSES = ['resolvido', 'fechado'];
const TICKET_INCLUDE = {
    client: { select: { id: true, name: true, email: true } },
    technician: { select: { id: true, name: true, email: true } },
    systemModule: { select: { id: true, name: true, isActive: true } },
    _count: { select: { activities: true } },
};
let TicketsService = class TicketsService {
    constructor(prisma, events) {
        this.prisma = prisma;
        this.events = events;
    }
    async list(user, query) {
        const page = Math.max(query.page ?? 1, 1);
        const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        const where = {};
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
        }
        else if (statusFilter !== 'all') {
            where.status = statusFilter;
        }
        const search = query.search?.trim();
        if (search) {
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
    async availableYears(user) {
        const where = {};
        if (user.role === 'client') {
            where.clientId = user.id;
        }
        const rows = await this.prisma.ticket.findMany({
            where,
            select: { createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        const years = new Set(rows.map((row) => row.createdAt.getUTCFullYear()));
        years.add((0, legacy_clock_1.instantToWallClockParts)(new Date()).year);
        return Array.from(years).sort((left, right) => right - left);
    }
    resolvePeriod(query) {
        if (query.allPeriods)
            return null;
        const nowParts = (0, legacy_clock_1.instantToWallClockParts)(new Date());
        const year = query.year ?? nowParts.year;
        const rawMonth = query.month ?? nowParts.month;
        const month = rawMonth >= 1 && rawMonth <= 12 ? rawMonth : nowParts.month;
        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = month === 12
            ? new Date(Date.UTC(year + 1, 0, 1))
            : new Date(Date.UTC(year, month, 1));
        return { year, month, start, end };
    }
    resolveStatusFilter(raw) {
        const value = (raw ?? '').trim().toLowerCase();
        return ticket_dto_1.TICKET_STATUS_FILTERS.includes(value)
            ? value
            : 'nao_concluidos';
    }
    async findOne(user, id) {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id },
            include: TICKET_INCLUDE,
        });
        if (!ticket || !(0, ticket_policy_1.canViewTicket)(user, ticket)) {
            throw new common_1.NotFoundException('Chamado não encontrado.');
        }
        return toTicketResponse(ticket);
    }
    async create(user, dto) {
        const { clientId, requiresExplicitClient } = (0, ticket_policy_1.resolveTicketClientId)(user, dto.clientId);
        if (requiresExplicitClient && clientId === null) {
            throw new common_1.BadRequestException('Selecione um cliente para abrir o chamado.');
        }
        const client = await this.prisma.user.findFirst({
            where: { id: clientId, role: 'client' },
            select: { id: true, name: true, email: true },
        });
        if (!client) {
            throw new common_1.BadRequestException('Cliente inválido.');
        }
        const systemModule = await this.prisma.systemModule.findFirst({
            where: { id: dto.systemModuleId, isActive: true },
            select: { id: true },
        });
        if (!systemModule) {
            throw new common_1.BadRequestException('Módulo inválido.');
        }
        const technicianId = await this.resolveTechnicianId(dto.technicianId ?? null);
        const ticket = await this.prisma.ticket.create({
            data: {
                title: dto.title,
                description: dto.description,
                clientId: client.id,
                technicianId,
                systemModuleId: systemModule.id,
            },
            include: TICKET_INCLUDE,
        });
        await this.events.publish(domain_events_1.TICKET_CREATED, {
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
    async update(user, id, dto) {
        if (!(0, ticket_policy_1.canEditTicket)(user)) {
            throw new common_1.ForbiddenException('Você não tem permissão para editar chamados.');
        }
        const existing = await this.prisma.ticket.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException('Chamado não encontrado.');
        }
        const client = await this.prisma.user.findFirst({
            where: { id: dto.clientId, role: 'client' },
            select: { id: true, name: true, email: true },
        });
        if (!client) {
            throw new common_1.BadRequestException('Cliente inválido.');
        }
        const systemModule = await this.prisma.systemModule.findUnique({
            where: { id: dto.systemModuleId },
            select: { id: true },
        });
        if (!systemModule) {
            throw new common_1.BadRequestException('Módulo inválido.');
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
    async changeStatus(user, id, dto) {
        if (!(0, ticket_policy_1.canChangeStatus)(user)) {
            throw new common_1.ForbiddenException('Você não tem permissão para alterar o status.');
        }
        const existing = await this.prisma.ticket.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException('Chamado não encontrado.');
        }
        const previousStatus = existing.status;
        const ticket = await this.prisma.ticket.update({
            where: { id },
            data: { status: dto.status },
            include: TICKET_INCLUDE,
        });
        if (previousStatus !== dto.status) {
            await this.publishStatusChanged(ticket, previousStatus);
        }
        return toTicketResponse(ticket);
    }
    async remove(user, id) {
        if (!(0, ticket_policy_1.canEditTicket)(user)) {
            throw new common_1.ForbiddenException('Você não tem permissão para excluir chamados.');
        }
        const existing = await this.prisma.ticket.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException('Chamado não encontrado.');
        }
        if (!(0, ticket_policy_1.canDeleteTicket)(user, existing)) {
            throw new common_1.ForbiddenException(deletion_window_1.TICKET_DELETE_WINDOW_MESSAGE);
        }
        await this.prisma.ticket.delete({ where: { id } });
    }
    async resolveTechnicianId(technicianId) {
        if (technicianId === null)
            return null;
        const technician = await this.prisma.user.findFirst({
            where: { id: technicianId, role: 'technician' },
            select: { id: true },
        });
        if (!technician) {
            throw new common_1.BadRequestException('Técnico inválido.');
        }
        return technician.id;
    }
    async publishStatusChanged(ticket, previousStatus) {
        await this.events.publish(domain_events_1.TICKET_STATUS_CHANGED, {
            ticketId: ticket.id,
            title: ticket.title,
            previousStatus,
            newStatus: ticket.status,
            clientId: ticket.client.id,
            clientName: ticket.client.name,
            clientEmail: ticket.client.email,
        });
    }
};
exports.TicketsService = TicketsService;
exports.TicketsService = TicketsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        domain_events_service_1.DomainEventsService])
], TicketsService);
function toTicketResponse(ticket) {
    return {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        statusLabel: (0, legacy_enums_1.statusLabel)(ticket.status),
        createdAt: ticket.createdAt.toISOString(),
        client: ticket.client,
        technician: ticket.technician,
        systemModule: ticket.systemModule,
        activityCount: ticket._count.activities,
    };
}
//# sourceMappingURL=tickets.service.js.map