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
exports.formatIsoDate = exports.parseIsoDate = exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const decimal_util_1 = require("../common/money/decimal.util");
const prisma_service_1 = require("../prisma/prisma.service");
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
let PaymentsService = class PaymentsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(query) {
        const page = Math.max(query.page ?? 1, 1);
        const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        const where = {};
        const from = query.from ? parseIsoDate(query.from, 'data inicial') : undefined;
        const to = query.to ? parseIsoDate(query.to, 'data final') : undefined;
        if (from && to && from.getTime() > to.getTime()) {
            throw new common_1.BadRequestException('A data inicial não pode ser posterior à data final.');
        }
        if (from || to) {
            where.paidAt = {};
            if (from)
                where.paidAt.gte = from;
            if (to)
                where.paidAt.lte = to;
        }
        const [items, total, aggregate] = await this.prisma.$transaction([
            this.prisma.paymentRecord.findMany({
                where,
                orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.paymentRecord.count({ where }),
            this.prisma.paymentRecord.aggregate({
                where,
                _sum: { amount: true, paidHours: true },
            }),
        ]);
        return {
            items: items.map(toPaymentResponse),
            total,
            page,
            pageSize,
            totalPages: Math.max(Math.ceil(total / pageSize), 1),
            totals: {
                amount: (0, decimal_util_1.toDecimalView)(aggregate._sum.amount ?? new client_1.Prisma.Decimal(0)),
                paidHours: (0, decimal_util_1.toDecimalView)(aggregate._sum.paidHours ?? new client_1.Prisma.Decimal(0)),
            },
        };
    }
    async findOne(id) {
        const payment = await this.prisma.paymentRecord.findUnique({ where: { id } });
        if (!payment) {
            throw new common_1.NotFoundException('Pagamento não encontrado.');
        }
        return toPaymentResponse(payment);
    }
    async create(dto) {
        const paidAt = parseIsoDate(dto.paidAt, 'data de pagamento');
        const amount = (0, decimal_util_1.parseDecimalInput)(dto.amount, 'o valor do pagamento');
        const paidHours = (0, decimal_util_1.parseDecimalInput)(dto.paidHours, 'as horas pagas');
        const payment = await this.prisma.paymentRecord.create({
            data: { paidAt, amount, paidHours },
        });
        return toPaymentResponse(payment);
    }
    async remove(id) {
        const existing = await this.prisma.paymentRecord.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException('Pagamento não encontrado.');
        }
        await this.prisma.paymentRecord.delete({ where: { id } });
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PaymentsService);
function parseIsoDate(raw, fieldName) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
    if (!match) {
        throw new common_1.BadRequestException(`Informe uma ${fieldName} válida (AAAA-MM-DD).`);
    }
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year ||
        date.getUTCMonth() + 1 !== month ||
        date.getUTCDate() !== day) {
        throw new common_1.BadRequestException(`Informe uma ${fieldName} válida (AAAA-MM-DD).`);
    }
    return date;
}
exports.parseIsoDate = parseIsoDate;
function formatIsoDate(date) {
    const year = String(date.getUTCFullYear()).padStart(4, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
exports.formatIsoDate = formatIsoDate;
function toPaymentResponse(payment) {
    return {
        id: payment.id,
        paidAt: formatIsoDate(payment.paidAt),
        amount: (0, decimal_util_1.toDecimalView)(payment.amount),
        paidHours: (0, decimal_util_1.toDecimalView)(payment.paidHours),
        createdAt: payment.createdAt.toISOString(),
    };
}
//# sourceMappingURL=payments.service.js.map