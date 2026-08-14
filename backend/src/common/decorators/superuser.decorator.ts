import { SetMetadata } from '@nestjs/common';

export const REQUIRES_SUPERUSER_KEY = 'requiresSuperuser';

/**
 * Exige `is_superuser`.
 *
 * Equivale ao `if not session.get("is_superuser", False)` que abre as rotas
 * administrativas do legado (parâmetros da empresa, módulos e pagamentos).
 * É mais restritivo que `@Roles('technician')`: um técnico comum não passa.
 */
export const RequiresSuperuser = () => SetMetadata(REQUIRES_SUPERUSER_KEY, true);
