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
exports.ActivityListResponse = exports.ActivityResponse = exports.UpdateActivityDto = exports.CreateActivityDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const trim = ({ value }) => typeof value === 'string' ? value.trim() : value;
class CreateActivityDto {
}
exports.CreateActivityDto = CreateActivityDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Descrição da atividade. Obrigatória.' }),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: 'Descreva a atividade.' }),
    (0, class_validator_1.MaxLength)(20000),
    __metadata("design:type", String)
], CreateActivityDto.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-03-10T08:30', description: 'Hora de parede.' }),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: 'Datas inválidas. Use data e hora válidas.' }),
    __metadata("design:type", String)
], CreateActivityDto.prototype, "startedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-03-10T10:45', description: 'Hora de parede.' }),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: 'Datas inválidas. Use data e hora válidas.' }),
    __metadata("design:type", String)
], CreateActivityDto.prototype, "endedAt", void 0);
class UpdateActivityDto extends CreateActivityDto {
}
exports.UpdateActivityDto = UpdateActivityDto;
class ActivityAuthorResponse {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ActivityAuthorResponse.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ActivityAuthorResponse.prototype, "name", void 0);
class ActivityResponse {
}
exports.ActivityResponse = ActivityResponse;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ActivityResponse.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ActivityResponse.prototype, "ticketId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ActivityResponse.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Hora de parede, ISO local sem fuso.' }),
    __metadata("design:type", String)
], ActivityResponse.prototype, "startedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Hora de parede, ISO local sem fuso.' }),
    __metadata("design:type", String)
], ActivityResponse.prototype, "endedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'dd/mm/aaaa HH:MM, como no legado.' }),
    __metadata("design:type", String)
], ActivityResponse.prototype, "startedLabel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'dd/mm/aaaa HH:MM.' }),
    __metadata("design:type", String)
], ActivityResponse.prototype, "endedLabel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Duração em horas, 2 casas.' }),
    __metadata("design:type", Number)
], ActivityResponse.prototype, "durationHours", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ActivityAuthorResponse }),
    __metadata("design:type", ActivityAuthorResponse)
], ActivityResponse.prototype, "createdBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Se o usuário atual pode editar (somente o autor).',
    }),
    __metadata("design:type", Boolean)
], ActivityResponse.prototype, "canEdit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Se o usuário atual pode excluir.' }),
    __metadata("design:type", Boolean)
], ActivityResponse.prototype, "canDelete", void 0);
class ActivityListResponse {
}
exports.ActivityListResponse = ActivityListResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [ActivityResponse] }),
    __metadata("design:type", Array)
], ActivityListResponse.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Soma das durações, 2 casas.' }),
    __metadata("design:type", Number)
], ActivityListResponse.prototype, "totalHours", void 0);
//# sourceMappingURL=activity.dto.js.map