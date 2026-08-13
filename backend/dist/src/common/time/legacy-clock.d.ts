export declare const LEGACY_TIMEZONE = "America/Sao_Paulo";
export interface WallClockParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
}
export declare function wallClockToStorage(parts: WallClockParts): Date;
export declare function storageToWallClock(stored: Date): WallClockParts;
export declare function parseWallClockInput(raw: string): Date;
export declare function instantToWallClockStorage(instant: Date): Date;
export declare function instantToWallClockParts(instant: Date): WallClockParts;
export declare function nowWallClock(now?: Date): Date;
export declare function formatWallClockIso(stored: Date): string;
export declare function formatWallClockPtBr(stored: Date): string;
export declare function monthPeriodBounds(year: number, month: number): [Date, Date];
export declare function startOfNextMonth(stored: Date): Date;
export declare function daysInMonth(year: number, month: number): number;
export declare function addMonths(stored: Date, months: number): Date;
export declare function durationHours(start: Date, end: Date): number;
