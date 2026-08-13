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
exports.AnalyticsResponse = exports.AnalyticsQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class AnalyticsQueryDto {
}
exports.AnalyticsQueryDto = AnalyticsQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Ano. Omitido com allPeriods=true = todo o período.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1970),
    __metadata("design:type", Number)
], AnalyticsQueryDto.prototype, "year", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        maximum: 12,
        description: 'Mês. Omitido = visão anual.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(12),
    __metadata("design:type", Number)
], AnalyticsQueryDto.prototype, "month", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Ignora ano e mês e usa todo o histórico.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    __metadata("design:type", Boolean)
], AnalyticsQueryDto.prototype, "allPeriods", void 0);
class BucketDto {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BucketDto.prototype, "key", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BucketDto.prototype, "label", void 0);
class CountByKeyDto {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CountByKeyDto.prototype, "key", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CountByKeyDto.prototype, "label", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CountByKeyDto.prototype, "count", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CountByKeyDto.prototype, "hours", void 0);
class KpisDto {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], KpisDto.prototype, "totalTickets", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], KpisDto.prototype, "concludedTickets", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], KpisDto.prototype, "openTickets", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], KpisDto.prototype, "totalHours", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], KpisDto.prototype, "averageHoursPerTicket", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], KpisDto.prototype, "averageFirstResponseHours", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], KpisDto.prototype, "ticketsWithActivity", void 0);
class BacklogDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Aberto ou em andamento, em todo o histórico do escopo.',
    }),
    __metadata("design:type", Number)
], BacklogDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BacklogDto.prototype, "oldestDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], BacklogDto.prototype, "oldestTicketId", void 0);
class TrendPointDto {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TrendPointDto.prototype, "label", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TrendPointDto.prototype, "year", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TrendPointDto.prototype, "month", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TrendPointDto.prototype, "tickets", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TrendPointDto.prototype, "hours", void 0);
class AnalyticsResponse {
}
exports.AnalyticsResponse = AnalyticsResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Rótulo da visão, como no legado.' }),
    __metadata("design:type", String)
], AnalyticsResponse.prototype, "periodLabel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['day', 'month'] }),
    __metadata("design:type", String)
], AnalyticsResponse.prototype, "bucketMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [BucketDto], description: 'Eixo do gráfico de atividade.' }),
    __metadata("design:type", Array)
], AnalyticsResponse.prototype, "buckets", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], AnalyticsResponse.prototype, "selectedYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], AnalyticsResponse.prototype, "selectedMonth", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [Number],
        description: 'Anos com chamados, mais o ano corrente.',
    }),
    __metadata("design:type", Array)
], AnalyticsResponse.prototype, "availableYears", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: KpisDto }),
    __metadata("design:type", KpisDto)
], AnalyticsResponse.prototype, "kpis", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BacklogDto }),
    __metadata("design:type", BacklogDto)
], AnalyticsResponse.prototype, "backlog", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [CountByKeyDto] }),
    __metadata("design:type", Array)
], AnalyticsResponse.prototype, "byStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [CountByKeyDto] }),
    __metadata("design:type", Array)
], AnalyticsResponse.prototype, "byModule", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [CountByKeyDto] }),
    __metadata("design:type", Array)
], AnalyticsResponse.prototype, "byTechnician", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [CountByKeyDto] }),
    __metadata("design:type", Array)
], AnalyticsResponse.prototype, "byClient", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [TrendPointDto],
        description: '12 meses encerrando no período.',
    }),
    __metadata("design:type", Array)
], AnalyticsResponse.prototype, "trend", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Linhas de chamado, para filtros cruzados no frontend.',
        isArray: true,
        type: Object,
    }),
    __metadata("design:type", Array)
], AnalyticsResponse.prototype, "tickets", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Linhas de atividade recortadas no período, para filtros cruzados.',
        isArray: true,
        type: Object,
    }),
    __metadata("design:type", Array)
], AnalyticsResponse.prototype, "activities", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Horas por bucket do eixo.', type: Object }),
    __metadata("design:type", Object)
], AnalyticsResponse.prototype, "hoursByBucket", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Chamados abertos por bucket do eixo.', type: Object }),
    __metadata("design:type", Object)
], AnalyticsResponse.prototype, "ticketsByBucket", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Saldo do banco de horas no ciclo corrente.' }),
    __metadata("design:type", Number)
], AnalyticsResponse.prototype, "accumulatedHours", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], AnalyticsResponse.prototype, "monthlyHoursAllowance", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Horas pagas no período selecionado.' }),
    __metadata("design:type", Number)
], AnalyticsResponse.prototype, "paidHoursInPeriod", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AnalyticsResponse.prototype, "cycleStartLabel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AnalyticsResponse.prototype, "cycleEndLabel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Rótulos e cores de status do legado.', type: Object }),
    __metadata("design:type", Object)
], AnalyticsResponse.prototype, "statusMeta", void 0);
//# sourceMappingURL=analytics.dto.js.map