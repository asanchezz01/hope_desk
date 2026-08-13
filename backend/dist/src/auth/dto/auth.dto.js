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
exports.MessageResponse = exports.LoginResponse = exports.TokenPairResponse = exports.AuthUserResponse = exports.ChangePasswordDto = exports.ResetPasswordDto = exports.ForgotPasswordDto = exports.RefreshTokenDto = exports.LoginDto = exports.PASSWORD_MAX_LENGTH = exports.PASSWORD_MIN_LENGTH = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.PASSWORD_MIN_LENGTH = 6;
exports.PASSWORD_MAX_LENGTH = 128;
const trimAndLower = ({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value;
class LoginDto {
}
exports.LoginDto = LoginDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'cliente@example.com' }),
    (0, class_transformer_1.Transform)(trimAndLower),
    (0, class_validator_1.IsEmail)({}, { message: 'Informe um e-mail válido.' }),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], LoginDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'senha-do-usuario' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Informe a senha.' }),
    (0, class_validator_1.MaxLength)(exports.PASSWORD_MAX_LENGTH),
    __metadata("design:type", String)
], LoginDto.prototype, "password", void 0);
class RefreshTokenDto {
}
exports.RefreshTokenDto = RefreshTokenDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RefreshTokenDto.prototype, "refreshToken", void 0);
class ForgotPasswordDto {
}
exports.ForgotPasswordDto = ForgotPasswordDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'cliente@example.com' }),
    (0, class_transformer_1.Transform)(trimAndLower),
    (0, class_validator_1.IsEmail)({}, { message: 'Informe um e-mail válido.' }),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ForgotPasswordDto.prototype, "email", void 0);
class ResetPasswordDto {
}
exports.ResetPasswordDto = ResetPasswordDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Token recebido por e-mail.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Token obrigatório.' }),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "token", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: exports.PASSWORD_MIN_LENGTH }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(exports.PASSWORD_MIN_LENGTH, {
        message: `A nova senha deve ter pelo menos ${exports.PASSWORD_MIN_LENGTH} caracteres.`,
    }),
    (0, class_validator_1.MaxLength)(exports.PASSWORD_MAX_LENGTH),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "confirmation", void 0);
class ChangePasswordDto {
}
exports.ChangePasswordDto = ChangePasswordDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Informe a senha atual.' }),
    (0, class_validator_1.MaxLength)(exports.PASSWORD_MAX_LENGTH),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "currentPassword", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: exports.PASSWORD_MIN_LENGTH }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(exports.PASSWORD_MIN_LENGTH, {
        message: `A nova senha deve ter pelo menos ${exports.PASSWORD_MIN_LENGTH} caracteres.`,
    }),
    (0, class_validator_1.MaxLength)(exports.PASSWORD_MAX_LENGTH),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "confirmation", void 0);
class AuthUserResponse {
}
exports.AuthUserResponse = AuthUserResponse;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], AuthUserResponse.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AuthUserResponse.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AuthUserResponse.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['client', 'technician'] }),
    __metadata("design:type", String)
], AuthUserResponse.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AuthUserResponse.prototype, "isSuperuser", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AuthUserResponse.prototype, "mustChangePassword", void 0);
class TokenPairResponse {
}
exports.TokenPairResponse = TokenPairResponse;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TokenPairResponse.prototype, "accessToken", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TokenPairResponse.prototype, "refreshToken", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Validade do access token, em segundos.' }),
    __metadata("design:type", Number)
], TokenPairResponse.prototype, "expiresIn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TokenPairResponse.prototype, "tokenType", void 0);
class LoginResponse extends TokenPairResponse {
}
exports.LoginResponse = LoginResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ type: AuthUserResponse }),
    __metadata("design:type", AuthUserResponse)
], LoginResponse.prototype, "user", void 0);
class MessageResponse {
}
exports.MessageResponse = MessageResponse;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MessageResponse.prototype, "message", void 0);
//# sourceMappingURL=auth.dto.js.map