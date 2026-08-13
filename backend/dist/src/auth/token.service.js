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
exports.TokenService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const node_crypto_1 = require("node:crypto");
const configuration_1 = require("../config/configuration");
const prisma_service_1 = require("../prisma/prisma.service");
const TOKEN_ISSUER = 'hope-desk';
let TokenService = class TokenService {
    constructor(jwtService, prisma, configService) {
        this.jwtService = jwtService;
        this.prisma = prisma;
        this.config = configService.getOrThrow(configuration_1.APP_CONFIG_NAMESPACE);
    }
    async issueTokens(user) {
        const accessPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            isSuperuser: user.isSuperuser,
            mustChangePassword: user.mustChangePassword,
            type: 'access',
        };
        const accessToken = await this.jwtService.signAsync(accessPayload, {
            secret: this.config.jwt.accessSecret,
            expiresIn: this.config.jwt.accessExpiresIn,
            issuer: TOKEN_ISSUER,
        });
        const jti = (0, node_crypto_1.randomUUID)();
        const refreshPayload = {
            sub: user.id,
            jti,
            type: 'refresh',
        };
        const refreshToken = await this.jwtService.signAsync(refreshPayload, {
            secret: this.config.jwt.refreshSecret,
            expiresIn: this.config.jwt.refreshExpiresIn,
            issuer: TOKEN_ISSUER,
        });
        await this.prisma.refreshToken.create({
            data: {
                userId: user.id,
                jti,
                expiresAt: this.decodeExpiry(refreshToken),
            },
        });
        return {
            accessToken,
            refreshToken,
            expiresIn: this.accessTokenLifetimeSeconds(accessToken),
        };
    }
    async verifyAccessToken(token) {
        let payload;
        try {
            payload = await this.jwtService.verifyAsync(token, {
                secret: this.config.jwt.accessSecret,
                issuer: TOKEN_ISSUER,
            });
        }
        catch {
            throw new common_1.UnauthorizedException('Token inválido ou expirado.');
        }
        if (payload.type !== 'access') {
            throw new common_1.UnauthorizedException('Token inválido ou expirado.');
        }
        return {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            isSuperuser: payload.isSuperuser,
            mustChangePassword: payload.mustChangePassword,
        };
    }
    async rotateRefreshToken(token) {
        let payload;
        try {
            payload = await this.jwtService.verifyAsync(token, {
                secret: this.config.jwt.refreshSecret,
                issuer: TOKEN_ISSUER,
            });
        }
        catch {
            throw new common_1.UnauthorizedException('Refresh token inválido ou expirado.');
        }
        if (payload.type !== 'refresh') {
            throw new common_1.UnauthorizedException('Refresh token inválido ou expirado.');
        }
        const stored = await this.prisma.refreshToken.findUnique({
            where: { jti: payload.jti },
        });
        if (!stored) {
            throw new common_1.UnauthorizedException('Refresh token inválido ou expirado.');
        }
        if (stored.revokedAt) {
            await this.revokeAllForUser(stored.userId);
            throw new common_1.UnauthorizedException('Refresh token já utilizado. Faça login novamente.');
        }
        if (stored.expiresAt.getTime() <= Date.now()) {
            throw new common_1.UnauthorizedException('Refresh token inválido ou expirado.');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: stored.userId },
            select: {
                id: true,
                email: true,
                role: true,
                isSuperuser: true,
                mustChangePassword: true,
            },
        });
        if (!user) {
            await this.revokeAllForUser(stored.userId);
            throw new common_1.UnauthorizedException('Refresh token inválido ou expirado.');
        }
        const tokens = await this.issueTokens(user);
        await this.prisma.refreshToken.update({
            where: { jti: payload.jti },
            data: {
                revokedAt: new Date(),
                replacedByJti: this.decodeJti(tokens.refreshToken),
            },
        });
        return { tokens, user };
    }
    async revokeRefreshToken(token) {
        let payload;
        try {
            payload = await this.jwtService.verifyAsync(token, {
                secret: this.config.jwt.refreshSecret,
                issuer: TOKEN_ISSUER,
            });
        }
        catch {
            return;
        }
        await this.prisma.refreshToken.updateMany({
            where: { jti: payload.jti, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
    async revokeAllForUser(userId) {
        const result = await this.prisma.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        return result.count;
    }
    async purgeExpired(now = new Date()) {
        const result = await this.prisma.refreshToken.deleteMany({
            where: { expiresAt: { lt: now } },
        });
        return result.count;
    }
    decodeExpiry(token) {
        const decoded = this.jwtService.decode(token);
        if (!decoded?.exp) {
            throw new Error('Token emitido sem claim exp.');
        }
        return new Date(decoded.exp * 1000);
    }
    decodeJti(token) {
        const decoded = this.jwtService.decode(token);
        if (!decoded?.jti) {
            throw new Error('Refresh token emitido sem jti.');
        }
        return decoded.jti;
    }
    accessTokenLifetimeSeconds(token) {
        const decoded = this.jwtService.decode(token);
        if (!decoded?.exp || !decoded?.iat)
            return 0;
        return decoded.exp - decoded.iat;
    }
};
exports.TokenService = TokenService;
exports.TokenService = TokenService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        prisma_service_1.PrismaService,
        config_1.ConfigService])
], TokenService);
//# sourceMappingURL=token.service.js.map