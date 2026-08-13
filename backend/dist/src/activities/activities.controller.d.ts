import { AuthenticatedUser } from '../auth/auth.types';
import { ActivitiesService } from './activities.service';
import { ActivityListResponse, ActivityResponse, CreateActivityDto, UpdateActivityDto } from './dto/activity.dto';
export declare class ActivitiesController {
    private readonly activitiesService;
    constructor(activitiesService: ActivitiesService);
    list(user: AuthenticatedUser, ticketId: number): Promise<ActivityListResponse>;
    create(user: AuthenticatedUser, ticketId: number, dto: CreateActivityDto): Promise<ActivityResponse>;
    update(user: AuthenticatedUser, ticketId: number, id: number, dto: UpdateActivityDto): Promise<ActivityResponse>;
    remove(user: AuthenticatedUser, ticketId: number, id: number): Promise<void>;
}
