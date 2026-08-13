export declare class AnalyticsQueryDto {
    year?: number;
    month?: number;
    allPeriods?: boolean;
}
declare class BucketDto {
    key: string;
    label: string;
}
declare class CountByKeyDto {
    key: string;
    label: string;
    count: number;
    hours: number;
}
declare class KpisDto {
    totalTickets: number;
    concludedTickets: number;
    openTickets: number;
    totalHours: number;
    averageHoursPerTicket: number;
    averageFirstResponseHours: number | null;
    ticketsWithActivity: number;
}
declare class BacklogDto {
    total: number;
    oldestDays: number;
    oldestTicketId: number | null;
}
declare class TrendPointDto {
    label: string;
    year: number;
    month: number;
    tickets: number;
    hours: number;
}
export declare class AnalyticsResponse {
    periodLabel: string;
    bucketMode: string;
    buckets: BucketDto[];
    selectedYear: number | null;
    selectedMonth: number | null;
    availableYears: number[];
    kpis: KpisDto;
    backlog: BacklogDto;
    byStatus: CountByKeyDto[];
    byModule: CountByKeyDto[];
    byTechnician: CountByKeyDto[];
    byClient: CountByKeyDto[];
    trend: TrendPointDto[];
    tickets: unknown[];
    activities: unknown[];
    hoursByBucket: Record<string, number>;
    ticketsByBucket: Record<string, number>;
    accumulatedHours: number;
    monthlyHoursAllowance: number;
    paidHoursInPeriod: number;
    cycleStartLabel: string;
    cycleEndLabel: string;
    statusMeta: Record<string, {
        label: string;
        color: string;
    }>;
}
export {};
