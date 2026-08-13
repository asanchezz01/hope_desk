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
exports.MonthlyHoursSummaryResponse = exports.HoursBankResponse = exports.HoursBankQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class HoursBankQueryDto {
}
exports.HoursBankQueryDto = HoursBankQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Referência do cálculo (ISO local, sem fuso). Default: agora em ' +
            'America/Sao_Paulo. Usado para reproduzir cenários históricos.',
        example: '2026-07-15T12:00:00',
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], HoursBankQueryDto.prototype, "reference", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Ano do recorte mensal. Default: ano corrente.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1970),
    __metadata("design:type", Number)
], HoursBankQueryDto.prototype, "year", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: 12 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(12),
    __metadata("design:type", Number)
], HoursBankQueryDto.prototype, "month", void 0);
class MonthlyBreakdownResponse {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MonthlyBreakdownResponse.prototype, "year", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MonthlyBreakdownResponse.prototype, "month", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Horas consumidas no mês, dentro do ciclo.' }),
    __metadata("design:type", Number)
], MonthlyBreakdownResponse.prototype, "consumedHours", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'max(consumido − franquia, 0).' }),
    __metadata("design:type", Number)
], MonthlyBreakdownResponse.prototype, "excessHours", void 0);
class HoursBankResponse {
}
exports.HoursBankResponse = HoursBankResponse;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Saldo líquido do ciclo: excesso − horas pagas. Nunca negativo.',
    }),
    __metadata("design:type", Number)
], HoursBankResponse.prototype, "netAccumulatedHours", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Excesso somado antes do desconto das horas pagas.' }),
    __metadata("design:type", Number)
], HoursBankResponse.prototype, "grossExcessHours", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Horas pagas dentro do ciclo (limites inclusivos).' }),
    __metadata("design:type", Number)
], HoursBankResponse.prototype, "paidHoursInCycle", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Franquia mensal efetiva.' }),
    __metadata("design:type", Number)
], HoursBankResponse.prototype, "franchiseHours", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Total consumido no ciclo, até a referência.' }),
    __metadata("design:type", Number)
], HoursBankResponse.prototype, "totalConsumedHours", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Início do ciclo, ISO local.' }),
    __metadata("design:type", String)
], HoursBankResponse.prototype, "cycleStart", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Fim do ciclo (exclusivo), ISO local.' }),
    __metadata("design:type", String)
], HoursBankResponse.prototype, "cycleEnd", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'dd/mm/aaaa, como os rótulos do legado.' }),
    __metadata("design:type", String)
], HoursBankResponse.prototype, "cycleStartLabel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'dd/mm/aaaa.' }),
    __metadata("design:type", String)
], HoursBankResponse.prototype, "cycleEndLabel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MonthlyBreakdownResponse] }),
    __metadata("design:type", Array)
], HoursBankResponse.prototype, "monthlyBreakdown", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Referência efetivamente usada, ISO local.' }),
    __metadata("design:type", String)
], HoursBankResponse.prototype, "reference", void 0);
class MonthlyHoursSummaryResponse {
}
exports.MonthlyHoursSummaryResponse = MonthlyHoursSummaryResponse;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MonthlyHoursSummaryResponse.prototype, "year", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MonthlyHoursSummaryResponse.prototype, "month", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Horas de atividades recortadas no mês.' }),
    __metadata("design:type", Number)
], MonthlyHoursSummaryResponse.prototype, "periodActivityHours", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Horas de atividades do mês ligadas a chamados criados em OUTROS meses.',
    }),
    __metadata("design:type", Number)
], MonthlyHoursSummaryResponse.prototype, "externalTicketActivityHours", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Horas pagas no mês (limite superior exclusivo, como no legado).',
    }),
    __metadata("design:type", Number)
], MonthlyHoursSummaryResponse.prototype, "paidHoursInMonth", void 0);
//# sourceMappingURL=hours-bank.dto.js.map