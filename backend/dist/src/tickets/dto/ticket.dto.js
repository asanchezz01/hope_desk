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
exports.PaginatedTicketsResponse = exports.TicketResponse = exports.ListTicketsQueryDto = exports.ChangeTicketStatusDto = exports.UpdateTicketDto = exports.CreateTicketDto = exports.TICKET_STATUS_FILTERS = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const legacy_enums_1 = require("../../common/domain/legacy-enums");
const trim = ({ value }) => typeof value === 'string' ? value.trim() : value;
exports.TICKET_STATUS_FILTERS = [
    'nao_concluidos',
    'all',
    ...legacy_enums_1.TICKET_STATUSES,
];
class CreateTicketDto {
}
exports.CreateTicketDto = CreateTicketDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: 'Título e descrição são obrigatórios.' }),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateTicketDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: 'Título e descrição são obrigatórios.' }),
    (0, class_validator_1.MaxLength)(20000),
    __metadata("design:type", String)
], CreateTicketDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Módulo do sistema. Obrigatório e precisa estar ATIVO.',
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ message: 'Módulo inválido.' }),
    (0, class_validator_1.Min)(1, { message: 'Módulo inválido.' }),
    __metadata("design:type", Number)
], CreateTicketDto.prototype, "systemModuleId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Cliente do chamado. Obrigatório para técnico/superuser; ignorado quando ' +
            'quem abre é o próprio cliente.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ message: 'Cliente inválido.' }),
    (0, class_validator_1.Min)(1, { message: 'Cliente inválido.' }),
    __metadata("design:type", Number)
], CreateTicketDto.prototype, "clientId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Técnico designado. Opcional.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ message: 'Técnico inválido.' }),
    (0, class_validator_1.Min)(1, { message: 'Técnico inválido.' }),
    __metadata("design:type", Number)
], CreateTicketDto.prototype, "technicianId", void 0);
class UpdateTicketDto {
}
exports.UpdateTicketDto = UpdateTicketDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: 'Título e descrição são obrigatórios.' }),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateTicketDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: 'Título e descrição são obrigatórios.' }),
    (0, class_validator_1.MaxLength)(20000),
    __metadata("design:type", String)
], UpdateTicketDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: legacy_enums_1.TICKET_STATUSES }),
    (0, class_validator_1.IsIn)(legacy_enums_1.TICKET_STATUSES, { message: 'Status inválido.' }),
    __metadata("design:type", String)
], UpdateTicketDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cliente do chamado. Obrigatório na edição.' }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ message: 'Cliente inválido.' }),
    (0, class_validator_1.Min)(1, { message: 'Cliente inválido.' }),
    __metadata("design:type", Number)
], UpdateTicketDto.prototype, "clientId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Módulo do sistema. Obrigatório, mas na edição **pode estar inativo** — ' +
            'o legado não filtra por is_active aqui.',
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ message: 'Módulo inválido.' }),
    (0, class_validator_1.Min)(1, { message: 'Módulo inválido.' }),
    __metadata("design:type", Number)
], UpdateTicketDto.prototype, "systemModuleId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Técnico designado. Envie null para desatribuir.',
        nullable: true,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === null || value === '' ? null : Number(value))),
    (0, class_validator_1.IsInt)({ message: 'Técnico inválido.' }),
    (0, class_validator_1.Min)(1, { message: 'Técnico inválido.' }),
    __metadata("design:type", Object)
], UpdateTicketDto.prototype, "technicianId", void 0);
class ChangeTicketStatusDto {
}
exports.ChangeTicketStatusDto = ChangeTicketStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: legacy_enums_1.TICKET_STATUSES }),
    (0, class_validator_1.IsIn)(legacy_enums_1.TICKET_STATUSES, { message: 'Status inválido.' }),
    __metadata("design:type", String)
], ChangeTicketStatusDto.prototype, "status", void 0);
class ListTicketsQueryDto {
}
exports.ListTicketsQueryDto = ListTicketsQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Ano de criação. Default: ano corrente (hora de São Paulo).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1970),
    __metadata("design:type", Number)
], ListTicketsQueryDto.prototype, "year", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        maximum: 12,
        description: 'Mês de criação. Default: mês corrente (hora de São Paulo).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListTicketsQueryDto.prototype, "month", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: exports.TICKET_STATUS_FILTERS,
        default: 'nao_concluidos',
        description: '`nao_concluidos` exclui resolvido e fechado; `all` não filtra. ' +
            'Valor desconhecido cai para `nao_concluidos`, como no legado.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListTicketsQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Ignora o filtro de período e busca em todo o histórico.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value === 'true' || value === true),
    __metadata("design:type", Boolean)
], ListTicketsQueryDto.prototype, "allPeriods", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Busca por ID exato ou por título.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ListTicketsQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, minimum: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListTicketsQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 25, minimum: 1, maximum: 100 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListTicketsQueryDto.prototype, "pageSize", void 0);
class TicketPartyResponse {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TicketPartyResponse.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TicketPartyResponse.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TicketPartyResponse.prototype, "email", void 0);
class TicketModuleResponse {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TicketModuleResponse.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TicketModuleResponse.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], TicketModuleResponse.prototype, "isActive", void 0);
class TicketResponse {
}
exports.TicketResponse = TicketResponse;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TicketResponse.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TicketResponse.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TicketResponse.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: legacy_enums_1.TICKET_STATUSES }),
    __metadata("design:type", String)
], TicketResponse.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Rótulo de apresentação (resolvido = Concluído).' }),
    __metadata("design:type", String)
], TicketResponse.prototype, "statusLabel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Instante UTC de criação, ISO 8601.' }),
    __metadata("design:type", String)
], TicketResponse.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TicketPartyResponse }),
    __metadata("design:type", TicketPartyResponse)
], TicketResponse.prototype, "client", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: TicketPartyResponse, nullable: true }),
    __metadata("design:type", Object)
], TicketResponse.prototype, "technician", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: TicketModuleResponse, nullable: true }),
    __metadata("design:type", Object)
], TicketResponse.prototype, "systemModule", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Quantidade de atividades registradas.' }),
    __metadata("design:type", Number)
], TicketResponse.prototype, "activityCount", void 0);
class PaginatedTicketsResponse {
}
exports.PaginatedTicketsResponse = PaginatedTicketsResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [TicketResponse] }),
    __metadata("design:type", Array)
], PaginatedTicketsResponse.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaginatedTicketsResponse.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaginatedTicketsResponse.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaginatedTicketsResponse.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaginatedTicketsResponse.prototype, "totalPages", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Filtros efetivamente aplicados.' }),
    __metadata("design:type", Object)
], PaginatedTicketsResponse.prototype, "appliedFilters", void 0);
//# sourceMappingURL=ticket.dto.js.map