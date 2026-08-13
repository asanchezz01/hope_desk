export declare const USER_ROLES: readonly ["client", "technician"];
export type UserRole = (typeof USER_ROLES)[number];
export declare const TICKET_STATUSES: readonly ["aberto", "em_andamento", "resolvido", "fechado"];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export declare const TICKET_STATUS_LABELS: Record<TicketStatus, string>;
export declare const SYSTEM_PARAMETER_DEFAULTS: {
    readonly company_logo: "";
    readonly company_name: "Hope Desk";
    readonly company_address: "Endereço não informado";
    readonly monthly_hours_allowance: "16";
    readonly hours_bank_closing_date: "2000-01-01";
};
export type SystemParameterKey = keyof typeof SYSTEM_PARAMETER_DEFAULTS;
export declare const SYSTEM_PARAMETER_KEYS: ("company_logo" | "company_name" | "company_address" | "monthly_hours_allowance" | "hours_bank_closing_date")[];
export declare function isUserRole(value: unknown): value is UserRole;
export declare function isTicketStatus(value: unknown): value is TicketStatus;
export declare function statusLabel(status: string): string;
