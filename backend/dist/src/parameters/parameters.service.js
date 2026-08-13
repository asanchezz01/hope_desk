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
exports.normalizeClosingDate = exports.normalizeHoursAllowance = exports.ParametersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const legacy_enums_1 = require("../common/domain/legacy-enums");
const prisma_service_1 = require("../prisma/prisma.service");
let ParametersService = class ParametersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async get(key) {
        const record = await this.prisma.systemParameter.findUnique({ where: { key } });
        const value = record?.value?.trim();
        return value ? value : legacy_enums_1.SYSTEM_PARAMETER_DEFAULTS[key];
    }
    async getMany(keys) {
        const records = await this.prisma.systemParameter.findMany({
            where: { key: { in: keys } },
        });
        const byKey = new Map(records.map((record) => [record.key, record.value]));
        const result = {};
        for (const key of keys) {
            const value = byKey.get(key)?.trim();
            result[key] = value ? value : legacy_enums_1.SYSTEM_PARAMETER_DEFAULTS[key];
        }
        return result;
    }
    async ensureDefaults() {
        const keys = Object.keys(legacy_enums_1.SYSTEM_PARAMETER_DEFAULTS);
        const existing = await this.prisma.systemParameter.findMany({
            where: { key: { in: keys } },
            select: { key: true },
        });
        const present = new Set(existing.map((record) => record.key));
        const missing = keys.filter((key) => !present.has(key));
        if (missing.length === 0)
            return;
        await this.prisma.systemParameter.createMany({
            data: missing.map((key) => ({
                key,
                value: legacy_enums_1.SYSTEM_PARAMETER_DEFAULTS[key],
            })),
            skipDuplicates: true,
        });
    }
    async findPublic() {
        const values = await this.getMany([
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
    async findAll() {
        await this.ensureDefaults();
        const values = await this.getMany([
            'company_name',
            'company_address',
            'company_logo',
            'monthly_hours_allowance',
            'hours_bank_closing_date',
        ]);
        return {
            companyName: values.company_name,
            companyAddress: values.company_address,
            companyLogo: values.company_logo,
            monthlyHoursAllowance: values.monthly_hours_allowance,
            hoursBankClosingDate: values.hours_bank_closing_date,
        };
    }
    async update(dto) {
        const updates = new Map();
        if (dto.companyName !== undefined) {
            updates.set('company_name', dto.companyName);
        }
        if (dto.companyAddress !== undefined) {
            updates.set('company_address', dto.companyAddress);
        }
        if (dto.companyLogo !== undefined) {
            updates.set('company_logo', dto.companyLogo);
        }
        if (dto.monthlyHoursAllowance !== undefined) {
            updates.set('monthly_hours_allowance', normalizeHoursAllowance(dto.monthlyHoursAllowance));
        }
        if (dto.hoursBankClosingDate !== undefined) {
            updates.set('hours_bank_closing_date', normalizeClosingDate(dto.hoursBankClosingDate));
        }
        if (updates.size > 0) {
            await this.prisma.$transaction(Array.from(updates.entries()).map(([key, value]) => this.prisma.systemParameter.upsert({
                where: { key },
                update: { value },
                create: { key, value },
            })));
        }
        return this.findAll();
    }
};
exports.ParametersService = ParametersService;
exports.ParametersService = ParametersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ParametersService);
function normalizeHoursAllowance(raw) {
    const normalized = raw.trim().replace(',', '.');
    if (!normalized) {
        throw new common_1.BadRequestException('Informe a quantidade de horas de franquia mensal.');
    }
    if (!/^\d+(\.\d+)?$/.test(normalized)) {
        throw new common_1.BadRequestException('A franquia mensal deve ser um número válido maior ou igual a zero.');
    }
    let value;
    try {
        value = new client_1.Prisma.Decimal(normalized);
    }
    catch {
        throw new common_1.BadRequestException('A franquia mensal deve ser um número válido maior ou igual a zero.');
    }
    if (value.isNegative()) {
        throw new common_1.BadRequestException('A franquia mensal deve ser um número válido maior ou igual a zero.');
    }
    return value.toFixed(2);
}
exports.normalizeHoursAllowance = normalizeHoursAllowance;
function normalizeClosingDate(raw) {
    const text = raw.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) {
        throw new common_1.BadRequestException('Informe uma data de fechamento do banco de horas válida.');
    }
    const [year, month, day] = match.slice(1).map(Number);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCFullYear() !== year ||
        candidate.getUTCMonth() + 1 !== month ||
        candidate.getUTCDate() !== day) {
        throw new common_1.BadRequestException('Informe uma data de fechamento do banco de horas válida.');
    }
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
exports.normalizeClosingDate = normalizeClosingDate;
//# sourceMappingURL=parameters.service.js.map