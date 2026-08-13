export type BucketMode = 'day' | 'month';
export interface AnalyticsBucket {
    key: string;
    label: string;
}
export interface AnalyticsTicketRow {
    id: number;
    title: string;
    status: string;
    statusLabel: string;
    module: string;
    client: string;
    technician: string;
    technicians: string[];
    bucket: string;
    createdAt: string;
    createdLabel: string;
    hours: number;
    responseHours: number | null;
    ageDays: number | null;
}
export interface AnalyticsActivityRow {
    ticketId: number;
    bucket: string;
    technician: string;
    hours: number;
    status: string;
    module: string;
    client: string;
}
export interface AnalyticsTrendPoint {
    label: string;
    year: number;
    month: number;
    tickets: number;
    hours: number;
}
export interface CountByKey {
    key: string;
    label: string;
    count: number;
    hours: number;
}
export interface AnalyticsKpis {
    totalTickets: number;
    concludedTickets: number;
    openTickets: number;
    totalHours: number;
    averageHoursPerTicket: number;
    averageFirstResponseHours: number | null;
    ticketsWithActivity: number;
}
export interface AnalyticsBacklog {
    total: number;
    oldestDays: number;
    oldestTicketId: number | null;
}
export declare const ANALYTICS_STATUS_META: Record<string, {
    label: string;
    color: string;
}>;
export declare const MONTHS_PT: {
    value: number;
    label: string;
}[];
export declare const MONTH_SHORT_PT: string[];
