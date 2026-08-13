import { AuthenticatedUser } from '../auth/auth.types';
import { DomainEventsService } from '../common/events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangeTicketStatusDto, CreateTicketDto, ListTicketsQueryDto, PaginatedTicketsResponse, TicketResponse, UpdateTicketDto } from './dto/ticket.dto';
export declare class TicketsService {
    private readonly prisma;
    private readonly events;
    constructor(prisma: PrismaService, events: DomainEventsService);
    list(user: AuthenticatedUser, query: ListTicketsQueryDto): Promise<PaginatedTicketsResponse>;
    availableYears(user: AuthenticatedUser): Promise<number[]>;
    private resolvePeriod;
    private resolveStatusFilter;
    findOne(user: AuthenticatedUser, id: number): Promise<TicketResponse>;
    create(user: AuthenticatedUser, dto: CreateTicketDto): Promise<TicketResponse>;
    update(user: AuthenticatedUser, id: number, dto: UpdateTicketDto): Promise<TicketResponse>;
    changeStatus(user: AuthenticatedUser, id: number, dto: ChangeTicketStatusDto): Promise<TicketResponse>;
    remove(user: AuthenticatedUser, id: number): Promise<void>;
    private resolveTechnicianId;
    private publishStatusChanged;
}
