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
exports.PaginatedSystemModulesResponse = exports.SystemModuleResponse = exports.ListSystemModulesQueryDto = exports.UpdateSystemModuleDto = exports.CreateSystemModuleDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const trim = ({ value }) => typeof value === 'string' ? value.trim() : value;
class CreateSystemModuleDto {
}
exports.CreateSystemModuleDto = CreateSystemModuleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 120, example: 'Financeiro' }),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: 'Informe o nome do módulo.' }),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateSystemModuleDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateSystemModuleDto.prototype, "isActive", void 0);
class UpdateSystemModuleDto {
}
exports.UpdateSystemModuleDto = UpdateSystemModuleDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: 'Informe o nome do módulo.' }),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateSystemModuleDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateSystemModuleDto.prototype, "isActive", void 0);
class ListSystemModulesQueryDto {
}
exports.ListSystemModulesQueryDto = ListSystemModulesQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Filtra por situação. Ausente devolve ativos e inativos.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (value === 'true' || value === true)
            return true;
        if (value === 'false' || value === false)
            return false;
        return value;
    }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ListSystemModulesQueryDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, minimum: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListSystemModulesQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 50, minimum: 1, maximum: 200 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListSystemModulesQueryDto.prototype, "pageSize", void 0);
class SystemModuleResponse {
}
exports.SystemModuleResponse = SystemModuleResponse;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SystemModuleResponse.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SystemModuleResponse.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SystemModuleResponse.prototype, "isActive", void 0);
class PaginatedSystemModulesResponse {
}
exports.PaginatedSystemModulesResponse = PaginatedSystemModulesResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [SystemModuleResponse] }),
    __metadata("design:type", Array)
], PaginatedSystemModulesResponse.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaginatedSystemModulesResponse.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaginatedSystemModulesResponse.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaginatedSystemModulesResponse.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaginatedSystemModulesResponse.prototype, "totalPages", void 0);
//# sourceMappingURL=system-module.dto.js.map