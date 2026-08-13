import { AuthenticatedUser } from '../auth/auth.types';
import { ChangeTicketStatusDto, CreateTicketDto, ListTicketsQueryDto, PaginatedTicketsResponse, TicketResponse, UpdateTicketDto } from './dto/ticket.dto';
import { TicketsService } from './tickets.service';
export declare class TicketsController {
    private readonly ticketsService;
    constructor(ticketsService: TicketsService);
    list(user: AuthenticatedUser, query: ListTicketsQueryDto): Promise<PaginatedTicketsResponse>;
    availableYears(user: AuthenticatedUser): Promise<number[]>;
    findOne(user: AuthenticatedUser, id: number): Promise<TicketResponse>;
    create(user: AuthenticatedUser, dto: CreateTicketDto): Promise<TicketResponse>;
    update(user: AuthenticatedUser, id: number, dto: UpdateTicketDto): Promise<TicketResponse>;
    changeStatus(user: AuthenticatedUser, id: number, dto: ChangeTicketStatusDto): Promise<TicketResponse>;
    remove(user: AuthenticatedUser, id: number): Promise<void>;
}
