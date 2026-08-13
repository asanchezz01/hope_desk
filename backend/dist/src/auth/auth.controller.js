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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AuthController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const public_decorator_1 = require("../common/decorators/public.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const domain_events_1 = require("../common/events/domain-events");
const domain_events_service_1 = require("../common/events/domain-events.service");
const auth_service_1 = require("./auth.service");
const auth_dto_1 = require("./dto/auth.dto");
let AuthController = AuthController_1 = class AuthController {
    constructor(authService, events) {
        this.authService = authService;
        this.events = events;
        this.logger = new common_1.Logger(AuthController_1.name);
    }
    login(dto) {
        return this.authService.login(dto);
    }
    refresh(dto) {
        return this.authService.refresh(dto.refreshToken);
    }
    async logout(dto) {
        await this.authService.logout(dto.refreshToken);
        return { message: 'Sessão encerrada.' };
    }
    async logoutAll(user) {
        const revoked = await this.authService.logoutAll(user.id);
        return { message: `${revoked} sessão(ões) encerrada(s).` };
    }
    me(user) {
        return this.authService.currentUser(user);
    }
    async changePassword(user, dto) {
        await this.authService.changePassword(user, dto);
        return { message: 'Senha alterada com sucesso. Faça login novamente.' };
    }
    async forgotPassword(dto) {
        const issued = await this.authService.issueResetToken(dto.email);
        if (issued) {
            this.logger.log(`Token de recuperação emitido para o usuário ${issued.userId} ` +
                `(expira em ${issued.expiresAt.toISOString()}).`);
            await this.events.publish(domain_events_1.PASSWORD_RESET_REQUESTED, {
                userId: issued.userId,
                name: issued.name,
                email: issued.email,
                token: issued.token,
                expiresAt: issued.expiresAt,
            });
        }
        return { message: auth_service_1.FORGOT_PASSWORD_MESSAGE };
    }
    async resetPassword(dto) {
        await this.authService.resetPassword(dto);
        return { message: 'Senha redefinida com sucesso. Faça login.' };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Autentica e emite o par de tokens' }),
    (0, swagger_1.ApiOkResponse)({ type: auth_dto_1.LoginResponse }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.LoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Rotaciona o refresh token',
        description: 'Emite um par novo e revoga o refresh token apresentado. Reapresentar um ' +
            'token já rotacionado revoga todas as sessões do usuário.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: auth_dto_1.TokenPairResponse }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.RefreshTokenDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Revoga o refresh token informado' }),
    (0, swagger_1.ApiOkResponse)({ type: auth_dto_1.MessageResponse }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.RefreshTokenDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, public_decorator_1.AllowPasswordChangePending)(),
    (0, common_1.Post)('logout-all'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Revoga todas as sessões do usuário atual' }),
    (0, swagger_1.ApiOkResponse)({ type: auth_dto_1.MessageResponse }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logoutAll", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, public_decorator_1.AllowPasswordChangePending)(),
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Usuário autenticado' }),
    (0, swagger_1.ApiOkResponse)({ type: auth_dto_1.AuthUserResponse }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, public_decorator_1.AllowPasswordChangePending)(),
    (0, common_1.Post)('change-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Troca a senha do usuário autenticado',
        description: 'Encerra todas as outras sessões e limpa a flag de troca obrigatória.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: auth_dto_1.MessageResponse }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, auth_dto_1.ChangePasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('forgot-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Solicita link de troca de senha',
        description: 'A resposta é idêntica exista ou não o e-mail cadastrado, para não revelar ' +
            'quais contas existem.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: auth_dto_1.MessageResponse }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.ForgotPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('reset-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Redefine a senha com o token recebido por e-mail' }),
    (0, swagger_1.ApiOkResponse)({ type: auth_dto_1.MessageResponse }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.ResetPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
exports.AuthController = AuthController = AuthController_1 = __decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        domain_events_service_1.DomainEventsService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map