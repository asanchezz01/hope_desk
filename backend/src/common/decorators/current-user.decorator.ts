import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/auth.types';

/**
 * Injeta o usuário autenticado, anexado à request pelo JwtAuthGuard.
 *
 * Nunca confie em ID de usuário vindo do corpo ou da query: use sempre este
 * decorator como fonte de identidade.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  },
);
