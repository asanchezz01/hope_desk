import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../../auth/auth.types';
import { UserRole } from '../domain/legacy-enums';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { REQUIRES_SUPERUSER_KEY } from '../decorators/superuser.decorator';

/**
 * Autorização por papel e por privilégio de superuser.
 *
 * Duas regras distintas do legado, nesta ordem:
 *
 * 1. `@RequiresSuperuser()` — as rotas administrativas
 *    (`manage_company_parameters`, `manage_system_modules`, `manage_payments`)
 *    começam com `if not session.get("is_superuser", False)`. Técnico comum
 *    **não** passa.
 * 2. `@Roles(...)` — `role_required` do legado:
 *    `if user_role not in roles and not is_super`, ou seja, superuser passa em
 *    qualquer exigência de papel.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    const requiresSuperuser = this.reflector.getAllAndOverride<boolean>(
      REQUIRES_SUPERUSER_KEY,
      targets,
    );

    if (requiresSuperuser) {
      if (!user?.isSuperuser) {
        throw new ForbiddenException('Apenas superuser pode executar esta operação.');
      }
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      targets,
    );

    // Sem @Roles: basta estar autenticado (o JwtAuthGuard já garantiu).
    if (!requiredRoles || requiredRoles.length === 0) return true;

    if (!user) {
      throw new ForbiddenException('Você não tem permissão para esta operação.');
    }

    if (user.isSuperuser) return true;

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Você não tem permissão para esta operação.');
    }

    return true;
  }
}
