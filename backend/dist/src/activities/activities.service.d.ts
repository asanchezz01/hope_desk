import { AuthenticatedUser } from '../auth/auth.types';
import { DomainEventsService } from '../common/events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityListResponse, ActivityResponse, CreateActivityDto, UpdateActivityDto } from './dto/activity.dto';
export declare class ActivitiesService {
    private readonly prisma;
    private readonly events;
    constructor(prisma: PrismaService, events: DomainEventsService);
    list(user: AuthenticatedUser, ticketId: number): Promise<ActivityListResponse>;
    create(user: AuthenticatedUser, ticketId: number, dto: CreateActivityDto): Promise<ActivityResponse>;
    update(user: AuthenticatedUser, ticketId: number, activityId: number, dto: UpdateActivityDto): Promise<ActivityResponse>;
    remove(user: AuthenticatedUser, ticketId: number, activityId: number): Promise<void>;
    private parsePeriod;
    private assertValidPeriod;
    private assertNoConflict;
    private loadVisibleTicket;
    private loadTicketForActivity;
    private loadActivityOfTicket;
    private toResponse;
}
