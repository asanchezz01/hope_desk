export declare const MAX_ACTIVITY_HOURS = 12;
export declare const PERIOD_ORDER_MESSAGE = "A data/hora de t\u00E9rmino deve ser posterior \u00E0 data/hora de in\u00EDcio.";
export declare const PERIOD_DURATION_MESSAGE = "A dura\u00E7\u00E3o da atividade n\u00E3o pode ser superior a 12 horas.";
export declare function validateActivityPeriod(startedAt: Date, endedAt: Date): string | null;
export interface ActivityInterval {
    id: number;
    startedAt: Date;
    endedAt: Date;
}
export declare function intervalsOverlap(left: {
    startedAt: Date;
    endedAt: Date;
}, right: {
    startedAt: Date;
    endedAt: Date;
}): boolean;
export declare function findActivityConflict(candidates: ActivityInterval[], startedAt: Date, endedAt: Date, excludeActivityId?: number): ActivityInterval | null;
export declare function activityDurationHours(startedAt: Date, endedAt: Date): number;
