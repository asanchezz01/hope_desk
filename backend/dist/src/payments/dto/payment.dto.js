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
exports.PaginatedPaymentsResponse = exports.PaymentTotalsResponse = exports.PaymentResponse = exports.ListPaymentsQueryDto = exports.CreatePaymentDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const trim = ({ value }) => typeof value === 'string' ? value.trim() : value;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
class CreatePaymentDto {
}
exports.CreatePaymentDto = CreatePaymentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Data do pagamento, AAAA-MM-DD.', example: '2026-07-15' }),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(ISO_DATE, { message: 'Informe uma data de pagamento válida (AAAA-MM-DD).' }),
    __metadata("design:type", String)
], CreatePaymentDto.prototype, "paidAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Valor pago. Aceita vírgula decimal. Não pode ser negativo.',
        example: '1500,00',
    }),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], CreatePaymentDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Horas pagas. Aceita vírgula decimal. Não pode ser negativo.',
        example: '10,5',
    }),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], CreatePaymentDto.prototype, "paidHours", void 0);
class ListPaymentsQueryDto {
}
exports.ListPaymentsQueryDto = ListPaymentsQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Início do período, AAAA-MM-DD (inclusivo).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(ISO_DATE, { message: 'Informe uma data inicial válida (AAAA-MM-DD).' }),
    __metadata("design:type", String)
], ListPaymentsQueryDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Fim do período, AAAA-MM-DD (inclusivo).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(ISO_DATE, { message: 'Informe uma data final válida (AAAA-MM-DD).' }),
    __metadata("design:type", String)
], ListPaymentsQueryDto.prototype, "to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, minimum: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListPaymentsQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 50, minimum: 1, maximum: 200 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListPaymentsQueryDto.prototype, "pageSize", void 0);
class DecimalViewResponse {
}
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Valor exato, ponto decimal. Use para cálculo.' }),
    __metadata("design:type", String)
], DecimalViewResponse.prototype, "value", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Apresentação pt-BR. Use apenas para exibir.' }),
    __metadata("design:type", String)
], DecimalViewResponse.prototype, "formatted", void 0);
class PaymentResponse {
}
exports.PaymentResponse = PaymentResponse;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaymentResponse.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'AAAA-MM-DD.' }),
    __metadata("design:type", String)
], PaymentResponse.prototype, "paidAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DecimalViewResponse }),
    __metadata("design:type", Object)
], PaymentResponse.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DecimalViewResponse }),
    __metadata("design:type", Object)
], PaymentResponse.prototype, "paidHours", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Instante UTC em ISO 8601.' }),
    __metadata("design:type", String)
], PaymentResponse.prototype, "createdAt", void 0);
class PaymentTotalsResponse {
}
exports.PaymentTotalsResponse = PaymentTotalsResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ type: DecimalViewResponse }),
    __metadata("design:type", Object)
], PaymentTotalsResponse.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DecimalViewResponse }),
    __metadata("design:type", Object)
], PaymentTotalsResponse.prototype, "paidHours", void 0);
class PaginatedPaymentsResponse {
}
exports.PaginatedPaymentsResponse = PaginatedPaymentsResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PaymentResponse] }),
    __metadata("design:type", Array)
], PaginatedPaymentsResponse.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaginatedPaymentsResponse.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaginatedPaymentsResponse.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaginatedPaymentsResponse.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaginatedPaymentsResponse.prototype, "totalPages", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: PaymentTotalsResponse,
        description: 'Totais do período filtrado inteiro, não apenas da página.',
    }),
    __metadata("design:type", PaymentTotalsResponse)
], PaginatedPaymentsResponse.prototype, "totals", void 0);
//# sourceMappingURL=payment.dto.js.map