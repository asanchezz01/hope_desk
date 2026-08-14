import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca uma rota como acessível sem autenticação (login, forgot/reset, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ALLOW_PASSWORD_CHANGE_PENDING_KEY = 'allowPasswordChangePending';

/**
 * Permite a rota mesmo quando o usuário está com `mustChangePassword`.
 *
 * Equivale ao `enforce_password_change` do legado, que liberava apenas
 * `change_password` e `logout`.
 */
export const AllowPasswordChangePending = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_PENDING_KEY, true);
