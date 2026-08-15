import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../domain/legacy-enums';

export const ROLES_KEY = 'roles';

/** Exige um dos papéis informados. Superuser sempre passa (paridade com o legado). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
