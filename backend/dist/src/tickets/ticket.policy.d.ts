import { AuthenticatedUser } from '../auth/auth.types';
export declare function canCreateForOtherClient(user: AuthenticatedUser): boolean;
export declare function canEditTicket(user: AuthenticatedUser): boolean;
export declare function canChangeStatus(user: AuthenticatedUser): boolean;
export declare function canViewTicket(user: AuthenticatedUser, ticket: {
    clientId: number;
}): boolean;
export declare function canDeleteTicket(user: AuthenticatedUser, ticket: {
    createdAt: Date;
}, now?: Date): boolean;
export declare function resolveTicketClientId(user: AuthenticatedUser, requestedClientId: number | undefined): {
    clientId: number | null;
    requiresExplicitClient: boolean;
};
