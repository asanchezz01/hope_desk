"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDecimalView = exports.sumDecimals = exports.formatBrl = exports.formatPtBr = exports.toCanonicalString = exports.parseDecimalInput = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
function parseDecimalInput(raw, fieldName) {
    if (raw instanceof client_1.Prisma.Decimal)
        return raw;
    const text = typeof raw === 'number' ? String(raw) : String(raw ?? '').trim();
    if (!text) {
        throw new common_1.BadRequestException(`Informe um valor para ${fieldName}.`);
    }
    const normalized = text.replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
        throw new common_1.BadRequestException(`${fieldName} deve ser um número válido.`);
    }
    let value;
    try {
        value = new client_1.Prisma.Decimal(normalized);
    }
    catch {
        throw new common_1.BadRequestException(`${fieldName} deve ser um número válido.`);
    }
    if (value.isNegative()) {
        throw new common_1.BadRequestException(`${fieldName} não pode ser negativo.`);
    }
    return value;
}
exports.parseDecimalInput = parseDecimalInput;
function toCanonicalString(value, scale = 2) {
    return new client_1.Prisma.Decimal(value).toFixed(scale);
}
exports.toCanonicalString = toCanonicalString;
function formatPtBr(value, scale = 2) {
    const fixed = new client_1.Prisma.Decimal(value).toFixed(scale);
    const negative = fixed.startsWith('-');
    const [integerPart, decimalPart] = (negative ? fixed.slice(1) : fixed).split('.');
    const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const formatted = decimalPart ? `${withThousands},${decimalPart}` : withThousands;
    return negative ? `-${formatted}` : formatted;
}
exports.formatPtBr = formatPtBr;
function formatBrl(value) {
    return `R$ ${formatPtBr(value, 2)}`;
}
exports.formatBrl = formatBrl;
function sumDecimals(values) {
    return values.reduce((total, value) => total.plus(new client_1.Prisma.Decimal(value)), new client_1.Prisma.Decimal(0));
}
exports.sumDecimals = sumDecimals;
function toDecimalView(value, scale = 2) {
    return {
        value: toCanonicalString(value, scale),
        formatted: formatPtBr(value, scale),
    };
}
exports.toDecimalView = toDecimalView;
//# sourceMappingURL=decimal.util.js.map