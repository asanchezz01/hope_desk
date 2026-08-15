import { UserRole } from '../common/domain/legacy-enums';

/** Payload do access token. Mantido pequeno e sem dados sensíveis. */
export interface AccessTokenPayload {
  /** ID do usuário. */
  sub: number;
  email: string;
  role: UserRole;
  isSuperuser: boolean;
  /** Obriga a troca de senha antes de usar o resto da API. */
  mustChangePassword: boolean;
  type: 'access';
}

/** Payload do refresh token. Só carrega o necessário para a rotação. */
export interface RefreshTokenPayload {
  sub: number;
  /** Identificador único desta emissão, persistido em `refresh_token.jti`. */
  jti: string;
  type: 'refresh';
}

/**
 * Usuário autenticado, anexado à request pelo JwtAuthGuard.
 * É a única forma de identidade que controllers e services devem consumir.
 */
export interface AuthenticatedUser {
  id: number;
  email: string;
  role: UserRole;
  isSuperuser: boolean;
  mustChangePassword: boolean;
}

export function isTechnician(user: AuthenticatedUser): boolean {
  return user.role === 'technician';
}

export function isClient(user: AuthenticatedUser): boolean {
  return user.role === 'client';
}
