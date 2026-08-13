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
exports.PaginatedUsersResponse = exports.UserResponse = exports.ListUsersQueryDto = exports.UpdateUserDto = exports.CreateUserDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const legacy_enums_1 = require("../../common/domain/legacy-enums");
const auth_dto_1 = require("../../auth/dto/auth.dto");
const trimAndLower = ({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }) => typeof value === 'string' ? value.trim() : value;
class CreateUserDto {
}
exports.CreateUserDto = CreateUserDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 120 }),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2, { message: 'Informe o nome.' }),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateUserDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 120 }),
    (0, class_transformer_1.Transform)(trimAndLower),
    (0, class_validator_1.IsEmail)({}, { message: 'Informe um e-mail válido.' }),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateUserDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: auth_dto_1.PASSWORD_MIN_LENGTH }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(auth_dto_1.PASSWORD_MIN_LENGTH, {
        message: `A senha deve ter pelo menos ${auth_dto_1.PASSWORD_MIN_LENGTH} caracteres.`,
    }),
    (0, class_validator_1.MaxLength)(auth_dto_1.PASSWORD_MAX_LENGTH),
    __metadata("design:type", String)
], CreateUserDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: legacy_enums_1.USER_ROLES }),
    (0, class_validator_1.IsIn)(legacy_enums_1.USER_ROLES, { message: 'Perfil deve ser client ou technician.' }),
    __metadata("design:type", String)
], CreateUserDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Somente superuser pode conceder. Default false.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateUserDto.prototype, "isSuperuser", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Exige troca de senha no primeiro acesso. Default false.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateUserDto.prototype, "mustChangePassword", void 0);
class UpdateUserDto {
}
exports.UpdateUserDto = UpdateUserDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trimAndLower),
    (0, class_validator_1.IsEmail)({}, { message: 'Informe um e-mail válido.' }),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: legacy_enums_1.USER_ROLES }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(legacy_enums_1.USER_ROLES, { message: 'Perfil deve ser client ou technician.' }),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Somente superuser pode alterar.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateUserDto.prototype, "isSuperuser", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateUserDto.prototype, "mustChangePassword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minLength: auth_dto_1.PASSWORD_MIN_LENGTH,
        description: 'Define uma senha nova para o usuário (ação administrativa).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(auth_dto_1.PASSWORD_MIN_LENGTH),
    (0, class_validator_1.MaxLength)(auth_dto_1.PASSWORD_MAX_LENGTH),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "password", void 0);
class ListUsersQueryDto {
}
exports.ListUsersQueryDto = ListUsersQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: legacy_enums_1.USER_ROLES }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(legacy_enums_1.USER_ROLES),
    __metadata("design:type", String)
], ListUsersQueryDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Busca por nome ou e-mail.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ListUsersQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, minimum: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListUsersQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 25, minimum: 1, maximum: 100 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListUsersQueryDto.prototype, "pageSize", void 0);
class UserResponse {
}
exports.UserResponse = UserResponse;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], UserResponse.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserResponse.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserResponse.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: legacy_enums_1.USER_ROLES }),
    __metadata("design:type", String)
], UserResponse.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserResponse.prototype, "isSuperuser", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserResponse.prototype, "mustChangePassword", void 0);
class PaginatedUsersResponse {
}
exports.PaginatedUsersResponse = PaginatedUsersResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [UserResponse] }),
    __metadata("design:type", Array)
], PaginatedUsersResponse.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaginatedUsersResponse.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaginatedUsersResponse.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaginatedUsersResponse.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaginatedUsersResponse.prototype, "totalPages", void 0);
//# sourceMappingURL=user.dto.js.map