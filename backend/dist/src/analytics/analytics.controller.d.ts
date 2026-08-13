import { AuthenticatedUser } from '../auth/auth.types';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, AnalyticsResponse } from './dto/analytics.dto';
export declare class AnalyticsController {
    private readonly analyticsService;
    constructor(analyticsService: AnalyticsService);
    getAnalytics(user: AuthenticatedUser, query: AnalyticsQueryDto): Promise<AnalyticsResponse>;
}
