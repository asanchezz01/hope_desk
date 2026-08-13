export declare class CreateSystemModuleDto {
    name: string;
    isActive?: boolean;
}
export declare class UpdateSystemModuleDto {
    name?: string;
    isActive?: boolean;
}
export declare class ListSystemModulesQueryDto {
    isActive?: boolean;
    page?: number;
    pageSize?: number;
}
export declare class SystemModuleResponse {
    id: number;
    name: string;
    isActive: boolean;
}
export declare class PaginatedSystemModulesResponse {
    items: SystemModuleResponse[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
