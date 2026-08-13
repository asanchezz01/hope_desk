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
exports.SystemModulesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const MODULE_SELECT = {
    id: true,
    name: true,
    isActive: true,
};
let SystemModulesService = class SystemModulesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(query) {
        const page = Math.max(query.page ?? 1, 1);
        const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        const where = {};
        if (query.isActive !== undefined) {
            where.isActive = query.isActive;
        }
        const [items, total] = await this.prisma.$transaction([
            this.prisma.systemModule.findMany({
                where,
                select: MODULE_SELECT,
                orderBy: [{ name: 'asc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.systemModule.count({ where }),
        ]);
        return {
            items,
            total,
            page,
            pageSize,
            totalPages: Math.max(Math.ceil(total / pageSize), 1),
        };
    }
    async listActive() {
        return this.prisma.systemModule.findMany({
            where: { isActive: true },
            select: MODULE_SELECT,
            orderBy: [{ name: 'asc' }],
        });
    }
    async findOne(id) {
        const systemModule = await this.prisma.systemModule.findUnique({
            where: { id },
            select: MODULE_SELECT,
        });
        if (!systemModule) {
            throw new common_1.NotFoundException('Módulo não encontrado.');
        }
        return systemModule;
    }
    async create(dto) {
        await this.assertNameAvailable(dto.name);
        try {
            return await this.prisma.systemModule.create({
                data: { name: dto.name, isActive: dto.isActive ?? true },
                select: MODULE_SELECT,
            });
        }
        catch (error) {
            throw this.translateUniqueViolation(error);
        }
    }
    async update(id, dto) {
        const existing = await this.prisma.systemModule.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException('Módulo não encontrado.');
        }
        if (dto.name !== undefined && !equalsIgnoreCase(dto.name, existing.name)) {
            await this.assertNameAvailable(dto.name);
        }
        const data = {};
        if (dto.name !== undefined)
            data.name = dto.name;
        if (dto.isActive !== undefined)
            data.isActive = dto.isActive;
        try {
            return await this.prisma.systemModule.update({
                where: { id },
                data,
                select: MODULE_SELECT,
            });
        }
        catch (error) {
            throw this.translateUniqueViolation(error);
        }
    }
    async toggle(id) {
        const existing = await this.prisma.systemModule.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException('Módulo não encontrado.');
        }
        return this.prisma.systemModule.update({
            where: { id },
            data: { isActive: !existing.isActive },
            select: MODULE_SELECT,
        });
    }
    async remove(id) {
        const existing = await this.prisma.systemModule.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException('Módulo não encontrado.');
        }
        const ticketCount = await this.prisma.ticket.count({
            where: { systemModuleId: id },
        });
        if (ticketCount > 0) {
            throw new common_1.ConflictException('Não é possível excluir um módulo com chamados vinculados. ' +
                'Desative-o em vez de excluir.');
        }
        await this.prisma.systemModule.delete({ where: { id } });
    }
    async assertNameAvailable(name) {
        const existing = await this.prisma.systemModule.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } },
            select: { id: true },
        });
        if (existing) {
            throw new common_1.ConflictException('Já existe um módulo com este nome.');
        }
    }
    translateUniqueViolation(error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002') {
            return new common_1.ConflictException('Já existe um módulo com este nome.');
        }
        return error;
    }
};
exports.SystemModulesService = SystemModulesService;
exports.SystemModulesService = SystemModulesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SystemModulesService);
function equalsIgnoreCase(left, right) {
    return left.toLowerCase() === right.toLowerCase();
}
//# sourceMappingURL=system-modules.service.js.map