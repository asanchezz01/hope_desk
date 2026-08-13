export declare class CreateActivityDto {
    notes: string;
    startedAt: string;
    endedAt: string;
}
export declare class UpdateActivityDto extends CreateActivityDto {
}
declare class ActivityAuthorResponse {
    id: number;
    name: string;
}
export declare class ActivityResponse {
    id: number;
    ticketId: number;
    notes: string;
    startedAt: string;
    endedAt: string;
    startedLabel: string;
    endedLabel: string;
    durationHours: number;
    createdBy: ActivityAuthorResponse;
    canEdit: boolean;
    canDelete: boolean;
}
export declare class ActivityListResponse {
    items: ActivityResponse[];
    totalHours: number;
}
export {};
