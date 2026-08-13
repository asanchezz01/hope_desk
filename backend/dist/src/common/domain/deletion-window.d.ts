export type StoredTimeKind = 'utc-instant' | 'wall-clock';
export interface DeletionWindowContext {
    recordDate: Date;
    kind: StoredTimeKind;
    isSuperuser: boolean;
    now?: Date;
}
export declare function canDeleteByMonth(context: DeletionWindowContext): boolean;
export declare const TICKET_DELETE_WINDOW_MESSAGE: string;
export declare const ACTIVITY_DELETE_WINDOW_MESSAGE: string;
