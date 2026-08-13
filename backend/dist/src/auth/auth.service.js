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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAuthUser = exports.hashResetToken = exports.AuthService = exports.FORGOT_PASSWORD_MESSAGE = exports.RESET_TOKEN_MAX_AGE_HOURS = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const password_service_1 = require("./password/password.service");
const token_service_1 = require("./token.service");
exports.RESET_TOKEN_MAX_AGE_HOURS = 2;
exports.FORGOT_PASSWORD_MESSAGE = 'Se o e-mail estiver cadastrado, enviaremos as instruções de troca de senha.';
let AuthService = AuthService_1 = class AuthService {
    constructor(prisma, passwordService, tokenService) {
        this.prisma = prisma;
        this.passwordService = passwordService;
        this.tokenService = tokenService;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (!user) {
            await this.passwordService.spendDummyWork();
            throw new common_1.UnauthorizedException('E-mail ou senha inválidos.');
        }
        const { valid, needsRehash } = await this.passwordService.verify(dto.password, user.passwordHash);
        if (!valid) {
            throw new common_1.UnauthorizedException('E-mail ou senha inválidos.');
        }
        if (needsRehash) {
            await this.rehashPassword(user.id, dto.password);
        }
        const tokens = await this.tokenService.issueTokens(user);
        return {
            ...tokens,
            tokenType: 'Bearer',
            user: toAuthUser(user),
        };
    }
    async rehashPassword(userId, plainPassword) {
        try {
            const passwordHash = await this.passwordService.hash(plainPassword);
            await this.prisma.user.update({
                where: { id: userId },
                data: { passwordHash },
            });
            this.logger.log(`Hash legado migrado para bcrypt (usuário ${userId}).`);
        }
        catch (error) {
            this.logger.warn(`Falha ao migrar hash legado do usuário ${userId}: ${error.message}`);
        }
    }
    async refresh(refreshToken) {
        const { tokens } = await this.tokenService.rotateRefreshToken(refreshToken);
        return { ...tokens, tokenType: 'Bearer' };
    }
    async logout(refreshToken) {
        await this.tokenService.revokeRefreshToken(refreshToken);
    }
    async logoutAll(userId) {
        return this.tokenService.revokeAllForUser(userId);
    }
    async currentUser(user) {
        const fresh = await this.prisma.user.findUnique({ where: { id: user.id } });
        if (!fresh) {
            throw new common_1.UnauthorizedException('Usuário não encontrado.');
        }
        return toAuthUser(fresh);
    }
    async changePassword(user, dto) {
        this.assertPasswordConfirmation(dto.password, dto.confirmation);
        const stored = await this.prisma.user.findUnique({ where: { id: user.id } });
        if (!stored) {
            throw new common_1.UnauthorizedException('Usuário não encontrado.');
        }
        const { valid } = await this.passwordService.verify(dto.currentPassword, stored.passwordHash);
        if (!valid) {
            throw new common_1.BadRequestException('A senha atual não confere.');
        }
        if (dto.currentPassword === dto.password) {
            throw new common_1.BadRequestException('A nova senha deve ser diferente da atual.');
        }
        const passwordHash = await this.passwordService.hash(dto.password);
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                mustChangePassword: false,
                resetTokenHash: null,
                resetTokenExpiresAt: null,
            },
        });
        await this.tokenService.revokeAllForUser(user.id);
    }
    async issueResetToken(email) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) {
            return null;
        }
        const token = (0, node_crypto_1.randomBytes)(32).toString('base64url');
        const expiresAt = new Date(Date.now() + exports.RESET_TOKEN_MAX_AGE_HOURS * 60 * 60 * 1000);
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                resetTokenHash: hashResetToken(token),
                resetTokenExpiresAt: expiresAt,
            },
        });
        return { token, userId: user.id, email: user.email, name: user.name, expiresAt };
    }
    async resetPassword(dto) {
        this.assertPasswordConfirmation(dto.password, dto.confirmation);
        const tokenHash = hashResetToken(dto.token);
        const candidate = await this.prisma.user.findFirst({
            where: {
                resetTokenHash: tokenHash,
                resetTokenExpiresAt: { gt: new Date() },
            },
        });
        if (!candidate?.resetTokenHash) {
            throw new common_1.BadRequestException('Link de troca de senha inválido ou expirado. Solicite um novo.');
        }
        if (!constantTimeEquals(candidate.resetTokenHash, tokenHash)) {
            throw new common_1.BadRequestException('Link de troca de senha inválido ou expirado. Solicite um novo.');
        }
        const passwordHash = await this.passwordService.hash(dto.password);
        await this.prisma.user.update({
            where: { id: candidate.id },
            data: {
                passwordHash,
                mustChangePassword: false,
                resetTokenHash: null,
                resetTokenExpiresAt: null,
            },
        });
        await this.tokenService.revokeAllForUser(candidate.id);
    }
    assertPasswordConfirmation(password, confirmation) {
        if (password !== confirmation) {
            throw new common_1.BadRequestException('A confirmação não confere com a nova senha.');
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        password_service_1.PasswordService,
        token_service_1.TokenService])
], AuthService);
function hashResetToken(token) {
    return (0, node_crypto_1.createHash)('sha256').update(token, 'utf8').digest('hex');
}
exports.hashResetToken = hashResetToken;
function constantTimeEquals(left, right) {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    if (leftBuffer.length !== rightBuffer.length)
        return false;
    return (0, node_crypto_1.timingSafeEqual)(leftBuffer, rightBuffer);
}
function toAuthUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isSuperuser: user.isSuperuser,
        mustChangePassword: user.mustChangePassword,
    };
}
exports.toAuthUser = toAuthUser;
//# sourceMappingURL=auth.service.js.map