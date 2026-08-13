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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const password_service_1 = require("../auth/password/password.service");
const token_service_1 = require("../auth/token.service");
const prisma_service_1 = require("../prisma/prisma.service");
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const USER_SELECT = {
    id: true,
    name: true,
    email: true,
    role: true,
    isSuperuser: true,
    mustChangePassword: true,
};
let UsersService = class UsersService {
    constructor(prisma, passwordService, tokenService) {
        this.prisma = prisma;
        this.passwordService = passwordService;
        this.tokenService = tokenService;
    }
    async list(query) {
        const page = Math.max(query.page ?? 1, 1);
        const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        const where = {};
        if (query.role) {
            where.role = query.role;
        }
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
            ];
        }
        const [items, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where,
                select: USER_SELECT,
                orderBy: [{ name: 'asc' }, { id: 'asc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.user.count({ where }),
        ]);
        return {
            items,
            total,
            page,
            pageSize,
            totalPages: Math.max(Math.ceil(total / pageSize), 1),
        };
    }
    async findOne(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: USER_SELECT,
        });
        if (!user) {
            throw new common_1.NotFoundException('Usuário não encontrado.');
        }
        return user;
    }
    async create(actor, dto) {
        if (dto.isSuperuser && !actor.isSuperuser) {
            throw new common_1.ForbiddenException('Somente um superuser pode conceder privilégio de superuser.');
        }
        await this.assertEmailAvailable(dto.email);
        const passwordHash = await this.passwordService.hash(dto.password);
        try {
            return await this.prisma.user.create({
                data: {
                    name: dto.name,
                    email: dto.email,
                    passwordHash,
                    role: dto.role,
                    isSuperuser: dto.isSuperuser ?? false,
                    mustChangePassword: dto.mustChangePassword ?? false,
                },
                select: USER_SELECT,
            });
        }
        catch (error) {
            throw this.translateUniqueViolation(error);
        }
    }
    async update(actor, id, dto) {
        const target = await this.prisma.user.findUnique({ where: { id } });
        if (!target) {
            throw new common_1.NotFoundException('Usuário não encontrado.');
        }
        if (dto.isSuperuser !== undefined && !actor.isSuperuser) {
            throw new common_1.ForbiddenException('Somente um superuser pode alterar o privilégio de superuser.');
        }
        if (dto.isSuperuser === false && target.isSuperuser) {
            await this.assertNotLastSuperuser(target.id);
        }
        if (dto.role && dto.role !== target.role && target.id === actor.id) {
            throw new common_1.BadRequestException('Você não pode alterar o seu próprio perfil.');
        }
        if (dto.email && dto.email !== target.email) {
            await this.assertEmailAvailable(dto.email);
        }
        const data = {};
        if (dto.name !== undefined)
            data.name = dto.name;
        if (dto.email !== undefined)
            data.email = dto.email;
        if (dto.role !== undefined)
            data.role = dto.role;
        if (dto.isSuperuser !== undefined)
            data.isSuperuser = dto.isSuperuser;
        if (dto.mustChangePassword !== undefined) {
            data.mustChangePassword = dto.mustChangePassword;
        }
        if (dto.password !== undefined) {
            data.passwordHash = await this.passwordService.hash(dto.password);
            data.resetTokenHash = null;
            data.resetTokenExpiresAt = null;
        }
        let updated;
        try {
            updated = await this.prisma.user.update({
                where: { id },
                data,
                select: USER_SELECT,
            });
        }
        catch (error) {
            throw this.translateUniqueViolation(error);
        }
        const invalidatesSessions = dto.password !== undefined ||
            dto.role !== undefined ||
            dto.isSuperuser !== undefined ||
            dto.mustChangePassword === true;
        if (invalidatesSessions) {
            await this.tokenService.revokeAllForUser(id);
        }
        return updated;
    }
    async remove(actor, id) {
        const target = await this.prisma.user.findUnique({ where: { id } });
        if (!target) {
            throw new common_1.NotFoundException('Usuário não encontrado.');
        }
        if (target.id === actor.id) {
            throw new common_1.BadRequestException('Você não pode excluir o seu próprio usuário.');
        }
        if (target.isSuperuser) {
            await this.assertNotLastSuperuser(target.id);
        }
        const [ticketsAsClient, ticketsAsTechnician, activities] = await Promise.all([
            this.prisma.ticket.count({ where: { clientId: id } }),
            this.prisma.ticket.count({ where: { technicianId: id } }),
            this.prisma.activity.count({ where: { createdById: id } }),
        ]);
        if (ticketsAsClient + ticketsAsTechnician + activities > 0) {
            throw new common_1.ConflictException('Não é possível excluir este usuário porque ele possui chamados ou ' +
                'atividades vinculadas.');
        }
        await this.prisma.user.delete({ where: { id } });
    }
    async listTechnicians() {
        return this.prisma.user.findMany({
            where: { role: 'technician' },
            select: USER_SELECT,
            orderBy: [{ name: 'asc' }],
        });
    }
    async listClients() {
        return this.prisma.user.findMany({
            where: { role: 'client' },
            select: USER_SELECT,
            orderBy: [{ name: 'asc' }],
        });
    }
    async assertEmailAvailable(email) {
        const existing = await this.prisma.user.findUnique({
            where: { email },
            select: { id: true },
        });
        if (existing) {
            throw new common_1.ConflictException('Já existe um usuário com este e-mail.');
        }
    }
    async assertNotLastSuperuser(userId) {
        const others = await this.prisma.user.count({
            where: { isSuperuser: true, id: { not: userId } },
        });
        if (others === 0) {
            throw new common_1.BadRequestException('Não é possível remover o último superuser do sistema.');
        }
    }
    translateUniqueViolation(error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002') {
            return new common_1.ConflictException('Já existe um usuário com este e-mail.');
        }
        return error;
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        password_service_1.PasswordService,
        token_service_1.TokenService])
], UsersService);
//# sourceMappingURL=users.service.js.map