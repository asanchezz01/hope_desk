import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.types';
import { APP_CONFIG_NAMESPACE, AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../common/domain/legacy-enums';
import { AuthenticatedUser } from './auth.types';
import {
  AuthUserResponse,
  ChangePasswordDto,
  LoginDto,
  LoginResponse,
  ResetPasswordDto,
  TokenPairResponse,
} from './dto/auth.dto';
import { PasswordService } from './password/password.service';
import { TokenService } from './token.service';

/** Validade do token de recuperação: 2 horas, como `RESET_TOKEN_MAX_AGE_HOURS`. */
export const RESET_TOKEN_MAX_AGE_HOURS = 2;

/**
 * Mensagem única do fluxo "esqueci minha senha".
 * Idêntica exista ou não o e-mail — não revela contas cadastradas.
 */
export const FORGOT_PASSWORD_MESSAGE =
  'Se o e-mail estiver cadastrado, enviaremos as instruções de troca de senha.';

export interface IssuedResetToken {
  /** Token em claro, enviado por e-mail. Nunca persistido nem registrado em log. */
  token: string;
  userId: number;
  email: string;
  name: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly audit: AuditService,
    configService: ConfigService,
  ) {
    this.config = configService.getOrThrow<AppConfig>(APP_CONFIG_NAMESPACE);
  }

  private readonly config: AppConfig;

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Gasta trabalho equivalente para não vazar existência da conta por latência.
      await this.passwordService.spendDummyWork();
      // O e-mail tentado é registrado; a RESPOSTA continua idêntica à de senha
      // errada. A trilha é interna e é o que permite detectar varredura de
      // contas — o cuidado de não vazar existência é com o cliente, não com o
      // log.
      await this.audit.record({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        actorId: null,
        actorEmail: dto.email,
        metadata: { reason: 'unknown_email' },
      });
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const { valid, needsRehash } = await this.passwordService.verify(
      dto.password,
      user.passwordHash,
    );

    if (!valid) {
      await this.audit.record({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        entityType: 'user',
        entityId: user.id,
        actorId: null,
        actorEmail: user.email,
        metadata: { reason: 'wrong_password' },
      });
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    // Rehash transparente do hash legado do Werkzeug no primeiro login válido.
    //
    // Desligável de propósito: enquanto o Flask estiver no ar sobre a mesma
    // base, regravar em bcrypt tranca o usuário fora do sistema antigo — o
    // Werkzeug não lê bcrypt, e não há volta sem redefinir a senha. Durante a
    // operação paralela isso precisa ficar desligado (`docs/CUTOVER.md` §6.1).
    const rehashed = needsRehash && this.config.passwordRehashEnabled;
    if (rehashed) {
      await this.rehashPassword(user.id, dto.password);
    }

    const tokens = await this.tokenService.issueTokens(user);

    await this.audit.record({
      action: AUDIT_ACTIONS.LOGIN_SUCCEEDED,
      entityType: 'user',
      entityId: user.id,
      actorId: user.id,
      actorEmail: user.email,
      // Registra o que de fato aconteceu, não o que seria feito: com o rehash
      // desligado, `needsRehash` continua verdadeiro e a trilha mentiria.
      metadata: { rehashed, rehashPending: needsRehash && !rehashed },
    });

    return {
      ...tokens,
      tokenType: 'Bearer',
      user: toAuthUser(user),
    };
  }

  private async rehashPassword(userId: number, plainPassword: string): Promise<void> {
    try {
      const passwordHash = await this.passwordService.hash(plainPassword);
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
      this.logger.log(`Hash legado migrado para bcrypt (usuário ${userId}).`);
    } catch (error) {
      // Falha no rehash não deve impedir o login: a senha já foi validada.
      this.logger.warn(
        `Falha ao migrar hash legado do usuário ${userId}: ${(error as Error).message}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Sessão
  // -------------------------------------------------------------------------

  async refresh(refreshToken: string): Promise<TokenPairResponse> {
    const { tokens } = await this.tokenService.rotateRefreshToken(refreshToken);
    return { ...tokens, tokenType: 'Bearer' };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokenService.revokeRefreshToken(refreshToken);
  }

  async logoutAll(userId: number): Promise<number> {
    const revoked = await this.tokenService.revokeAllForUser(userId);

    // Encerrar todas as sessões é o que alguém faz ao suspeitar de acesso
    // indevido — e também o que um invasor faz para expulsar o dono da conta.
    // A trilha guarda quantas sessões caíram, que é o que diferencia "eu tinha
    // duas sessões" de "havia seis".
    await this.audit.record({
      action: AUDIT_ACTIONS.LOGOUT_ALL,
      entityType: 'user',
      entityId: userId,
      metadata: { revokedSessions: revoked },
    });

    return revoked;
  }

  async currentUser(user: AuthenticatedUser): Promise<AuthUserResponse> {
    // Relê do banco: papel e flags podem ter mudado desde a emissão do token.
    const fresh = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!fresh) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }
    return toAuthUser(fresh);
  }

  // -------------------------------------------------------------------------
  // Troca de senha autenticada
  // -------------------------------------------------------------------------

  async changePassword(user: AuthenticatedUser, dto: ChangePasswordDto): Promise<void> {
    this.assertPasswordConfirmation(dto.password, dto.confirmation);

    const stored = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!stored) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    const { valid } = await this.passwordService.verify(
      dto.currentPassword,
      stored.passwordHash,
    );
    if (!valid) {
      throw new BadRequestException('A senha atual não confere.');
    }

    if (dto.currentPassword === dto.password) {
      throw new BadRequestException('A nova senha deve ser diferente da atual.');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        // Um token de recuperação pendente perde validade.
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });

    // Troca de senha encerra todas as outras sessões.
    await this.tokenService.revokeAllForUser(user.id);

    await this.audit.record({
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      entityType: 'user',
      entityId: user.id,
      actorId: user.id,
      actorEmail: stored.email,
    });
  }

  // -------------------------------------------------------------------------
  // Recuperação de senha
  // -------------------------------------------------------------------------

  /**
   * Emite um token de recuperação, se o e-mail existir.
   *
   * Devolve `null` quando o e-mail não existe — o controller responde a mesma
   * mensagem nos dois casos, como o legado.
   */
  async issueResetToken(email: string): Promise<IssuedResetToken | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return null;
    }

    // 32 bytes ≈ 43 caracteres em base64url, como `secrets.token_urlsafe(32)`.
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_MAX_AGE_HOURS * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: hashResetToken(token),
        resetTokenExpiresAt: expiresAt,
      },
    });

    // Registrado apenas quando a conta existe. A RESPOSTA continua idêntica nos
    // dois casos (é a regra do legado contra enumeração de e-mail): a diferença
    // fica na trilha, que só quem já é superuser consegue ler.
    await this.audit.record({
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
      entityType: 'user',
      entityId: user.id,
      actorId: user.id,
      actorEmail: user.email,
      metadata: { expiresAt: expiresAt.toISOString() },
    });

    return { token, userId: user.id, email: user.email, name: user.name, expiresAt };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    this.assertPasswordConfirmation(dto.password, dto.confirmation);

    const tokenHash = hashResetToken(dto.token);

    const candidate = await this.prisma.user.findFirst({
      where: {
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: { gt: new Date() },
      },
    });

    // Mensagem única: token inexistente e token expirado são indistinguíveis.
    if (!candidate?.resetTokenHash) {
      throw new BadRequestException(
        'Link de troca de senha inválido ou expirado. Solicite um novo.',
      );
    }

    // Comparação em tempo constante, mesmo já tendo filtrado no banco.
    if (!constantTimeEquals(candidate.resetTokenHash, tokenHash)) {
      throw new BadRequestException(
        'Link de troca de senha inválido ou expirado. Solicite um novo.',
      );
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    await this.prisma.user.update({
      where: { id: candidate.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        // Token de uso único: invalidado imediatamente (endurecimento).
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });

    // Redefinir senha encerra todas as sessões existentes.
    await this.tokenService.revokeAllForUser(candidate.id);

    // Fecha o par com `PASSWORD_RESET_REQUESTED`: pedido sem conclusão é
    // rotina (a pessoa desistiu), mas uma conclusão sem pedido correspondente
    // significaria que o token chegou por outro caminho.
    await this.audit.record({
      action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
      entityType: 'user',
      entityId: candidate.id,
      actorId: candidate.id,
      actorEmail: candidate.email,
    });
  }

  /** `validate_new_password` do legado: tamanho (nos DTOs) e confirmação. */
  private assertPasswordConfirmation(password: string, confirmation: string): void {
    if (password !== confirmation) {
      throw new BadRequestException('A confirmação não confere com a nova senha.');
    }
  }
}

/** `hash_reset_token` do legado: SHA-256 hex do token. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: string;
  isSuperuser: boolean;
  mustChangePassword: boolean;
}

/** Projeção segura: nunca expõe hash de senha nem token de recuperação. */
export function toAuthUser(user: UserRecord): AuthUserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    isSuperuser: user.isSuperuser,
    mustChangePassword: user.mustChangePassword,
  };
}
