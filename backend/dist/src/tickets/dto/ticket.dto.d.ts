import { TicketStatus } from '../../common/domain/legacy-enums';
export declare const TICKET_STATUS_FILTERS: readonly ["nao_concluidos", "all", "aberto", "em_andamento", "resolvido", "fechado"];
export type TicketStatusFilter = (typeof TICKET_STATUS_FILTERS)[number];
export declare class CreateTicketDto {
    title: string;
    description: string;
    systemModuleId: number;
    clientId?: number;
    technicianId?: number;
}
export declare class UpdateTicketDto {
    title: string;
    description: string;
    status: TicketStatus;
    clientId: number;
    systemModuleId: number;
    technicianId?: number | null;
}
export declare class ChangeTicketStatusDto {
    status: TicketStatus;
}
export declare class ListTicketsQueryDto {
    year?: number;
    month?: number;
    status?: string;
    allPeriods?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
}
declare class TicketPartyResponse {
    id: number;
    name: string;
    email: string;
}
declare class TicketModuleResponse {
    id: number;
    name: string;
    isActive: boolean;
}
export declare class TicketResponse {
    id: number;
    title: string;
    description: string;
    status: string;
    statusLabel: string;
    createdAt: string;
    client: TicketPartyResponse;
    technician: TicketPartyResponse | null;
    systemModule: TicketModuleResponse | null;
    activityCount: number;
}
export declare class PaginatedTicketsResponse {
    items: TicketResponse[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    appliedFilters: {
        year: number | null;
        month: number | null;
        status: string;
        search: string | null;
    };
}
export {};
