export declare const TICKET_CREATED: "ticket.created";
export declare const TICKET_STATUS_CHANGED: "ticket.status-changed";
export declare const ACTIVITY_CREATED: "activity.created";
export declare const PASSWORD_RESET_REQUESTED: "password.reset-requested";
export interface TicketCreatedEvent {
    ticketId: number;
    title: string;
    description: string;
    clientId: number;
    clientName: string;
    clientEmail: string;
    technicianId: number | null;
}
export interface TicketStatusChangedEvent {
    ticketId: number;
    title: string;
    previousStatus: string;
    newStatus: string;
    clientId: number;
    clientName: string;
    clientEmail: string;
}
export interface ActivityCreatedEvent {
    activityId: number;
    ticketId: number;
    ticketTitle: string;
    notes: string;
    startedAt: Date;
    endedAt: Date;
    technicianId: number;
    technicianName: string;
    clientId: number;
    clientName: string;
    clientEmail: string;
}
export interface PasswordResetRequestedEvent {
    userId: number;
    name: string;
    email: string;
    token: string;
    expiresAt: Date;
}
export interface DomainEventMap {
    [TICKET_CREATED]: TicketCreatedEvent;
    [TICKET_STATUS_CHANGED]: TicketStatusChangedEvent;
    [ACTIVITY_CREATED]: ActivityCreatedEvent;
    [PASSWORD_RESET_REQUESTED]: PasswordResetRequestedEvent;
}
export type DomainEventName = keyof DomainEventMap;
