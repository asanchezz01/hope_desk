import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  ALLOW_PASSWORD_CHANGE_PENDING_KEY,
  IS_PUBLIC_KEY,
} from '../../common/decorators/public.decorator';
import { TokenService } from '../token.service';

/**
 * Autenticação por Bearer token.
 *
 * Também aplica o equivalente ao `enforce_password_change` do legado: um usuário
 * com `mustChangePassword` só acessa rotas marcadas com
 * `@AllowPasswordChangePending()` (troca de senha, logout e usuário atual).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Autenticação obrigatória.');
    }

    const user = await this.tokenService.verifyAccessToken(token);

    if (user.mustChangePassword) {
      const allowed = this.reflector.getAllAndOverride<boolean>(
        ALLOW_PASSWORD_CHANGE_PENDING_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (!allowed) {
        throw new ForbiddenException(
          'Você precisa definir uma nova senha antes de continuar.',
        );
      }
    }

    // Fonte única de identidade para controllers e services.
    (request as Request & { user?: unknown }).user = user;
    return true;
  }
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header) return null;

  const [scheme, value] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) return null;

  return value.trim() || null;
}
