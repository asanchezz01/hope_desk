import { UserRole } from '../common/domain/legacy-enums';
export interface AccessTokenPayload {
    sub: number;
    email: string;
    role: UserRole;
    isSuperuser: boolean;
    mustChangePassword: boolean;
    type: 'access';
}
export interface RefreshTokenPayload {
    sub: number;
    jti: string;
    type: 'refresh';
}
export interface AuthenticatedUser {
    id: number;
    email: string;
    role: UserRole;
    isSuperuser: boolean;
    mustChangePassword: boolean;
}
export declare function isTechnician(user: AuthenticatedUser): boolean;
export declare function isClient(user: AuthenticatedUser): boolean;
