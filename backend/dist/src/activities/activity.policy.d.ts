import { AuthenticatedUser } from '../auth/auth.types';
export declare function canCreateActivity(user: AuthenticatedUser): boolean;
export declare function canEditActivity(user: AuthenticatedUser, activity: {
    createdById: number;
}): boolean;
export declare function canDeleteActivity(user: AuthenticatedUser, activity: {
    startedAt: Date;
}, now?: Date): boolean;
