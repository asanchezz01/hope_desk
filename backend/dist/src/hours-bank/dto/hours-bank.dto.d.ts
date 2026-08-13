export declare class HoursBankQueryDto {
    reference?: string;
    year?: number;
    month?: number;
}
declare class MonthlyBreakdownResponse {
    year: number;
    month: number;
    consumedHours: number;
    excessHours: number;
}
export declare class HoursBankResponse {
    netAccumulatedHours: number;
    grossExcessHours: number;
    paidHoursInCycle: number;
    franchiseHours: number;
    totalConsumedHours: number;
    cycleStart: string;
    cycleEnd: string;
    cycleStartLabel: string;
    cycleEndLabel: string;
    monthlyBreakdown: MonthlyBreakdownResponse[];
    reference: string;
}
export declare class MonthlyHoursSummaryResponse {
    year: number;
    month: number;
    periodActivityHours: number;
    externalTicketActivityHours: number;
    paidHoursInMonth: number;
}
export {};
