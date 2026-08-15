import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG_NAMESPACE, AppConfig } from '../config/configuration';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.types';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../common/domain/legacy-enums';
import {
  AccessTokenPayload,
  AuthenticatedUser,
  RefreshTokenPayload,
} from './auth.types';

const TOKEN_ISSUER = 'hope-desk';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserForToken {
  id: number;
  email: string;
  role: string;
  isSuperuser: boolean;
  mustChangePassword: boolean;
}

/**
 * Emissão, verificação e rotação de tokens.
 *
 * Refresh tokens são **rotativos**: cada uso emite um par novo e revoga o
 * anterior. Só o `jti` é persistido — o token em si nunca toca o banco.
 *
 * Reuso de um token já rotacionado é tratado como comprometimento: toda a
 * família de tokens daquele usuário é revogada.
 */
@Injectable()
export class TokenService {
  private readonly config: AppConfig;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    configService: ConfigService,
  ) {
    this.config = configService.getOrThrow<AppConfig>(APP_CONFIG_NAMESPACE);
  }

  async issueTokens(user: UserForToken): Promise<IssuedTokens> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      isSuperuser: user.isSuperuser,
      mustChangePassword: user.mustChangePassword,
      type: 'access',
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.config.jwt.accessSecret,
      expiresIn: this.config.jwt.accessExpiresIn,
      issuer: TOKEN_ISSUER,
    });

    const jti = randomUUID();
    const refreshPayload: RefreshTokenPayload = {
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

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.jwt.accessSecret,
        issuer: TOKEN_ISSUER,
      });
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }

    // Impede que um refresh token seja usado como access token.
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      isSuperuser: payload.isSuperuser,
      mustChangePassword: payload.mustChangePassword,
    };
  }

  /**
   * Rotaciona um refresh token: valida, revoga o antigo e emite um par novo.
   * Detecta reuso de token já rotacionado e revoga tudo do usuário.
   */
  async rotateRefreshToken(token: string): Promise<{
    tokens: IssuedTokens;
    user: UserForToken;
  }> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.jwt.refreshSecret,
        issuer: TOKEN_ISSUER,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    if (stored.revokedAt) {
      // Token já rotacionado sendo reapresentado: possível roubo de token.
      // Revoga a família inteira e força novo login.
      await this.revokeAllForUser(stored.userId);

      // O único evento aqui que é indício de ATAQUE, e não de uso normal.
      // Também acontece por defeito de cliente (dois refreshes concorrentes
      // com o mesmo token), e é exatamente por isso que precisa ficar
      // registrado: sem a trilha, as duas causas são indistinguíveis a
      // posteriori — o sintoma é o mesmo logout inexplicado.
      await this.audit.record({
        action: AUDIT_ACTIONS.REFRESH_REUSE_DETECTED,
        entityType: 'user',
        entityId: stored.userId,
        actorId: stored.userId,
        metadata: { jti: payload.jti },
      });
      throw new UnauthorizedException(
        'Refresh token já utilizado. Faça login novamente.',
      );
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
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
      // Usuário removido: o token não vale mais nada.
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
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

  /** Revoga um refresh token específico (logout). Idempotente. */
  async revokeRefreshToken(token: string): Promise<void> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.jwt.refreshSecret,
        issuer: TOKEN_ISSUER,
      });
    } catch {
      // Logout não deve falhar por token inválido: o efeito desejado já é o atual.
      return;
    }

    await this.prisma.refreshToken.updateMany({
      where: { jti: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoga todas as sessões de um usuário (troca de senha, reset, suspeita). */
  async revokeAllForUser(userId: number): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  /** Remove tokens expirados. Chamável por rotina de manutenção. */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return result.count;
  }

  private decodeExpiry(token: string): Date {
    const decoded = this.jwtService.decode(token) as { exp?: number } | null;
    if (!decoded?.exp) {
      throw new Error('Token emitido sem claim exp.');
    }
    return new Date(decoded.exp * 1000);
  }

  private decodeJti(token: string): string {
    const decoded = this.jwtService.decode(token) as { jti?: string } | null;
    if (!decoded?.jti) {
      throw new Error('Refresh token emitido sem jti.');
    }
    return decoded.jti;
  }

  private accessTokenLifetimeSeconds(token: string): number {
    const decoded = this.jwtService.decode(token) as {
      exp?: number;
      iat?: number;
    } | null;
    if (!decoded?.exp || !decoded?.iat) return 0;
    return decoded.exp - decoded.iat;
  }
}
