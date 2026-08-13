import { Prisma } from '@prisma/client';
export declare const DEFAULT_MONTHLY_HOURS_ALLOWANCE = 16;
export interface HoursBankActivity {
    startedAt: Date;
    endedAt: Date;
}
export interface HoursBankPayment {
    paidAt: Date;
    paidHours: Prisma.Decimal | string | number;
}
export interface HoursBankInput {
    monthlyHoursAllowanceRaw: string;
    hoursBankClosingDateRaw: string;
    reference: Date;
    activities: HoursBankActivity[];
    payments: HoursBankPayment[];
}
export interface MonthlyBreakdown {
    year: number;
    month: number;
    consumedHours: number;
    excessHours: number;
}
export interface HoursBankResult {
    netAccumulatedHours: number;
    grossExcessHours: number;
    paidHoursInCycle: number;
    franchiseHours: number;
    cycleStart: Date;
    cycleEnd: Date;
    monthlyBreakdown: MonthlyBreakdown[];
    totalConsumedHours: number;
}
export declare function resolveHoursBankWindow(closingDateRaw: string, reference: Date): {
    cycleStart: Date;
    cycleEnd: Date;
};
export declare function resolveFranchiseHours(raw: string): number;
export declare function calculateHoursBank(input: HoursBankInput): HoursBankResult;
export declare function calculatePaidHoursForMonth(payments: HoursBankPayment[], year: number, month: number): number;
