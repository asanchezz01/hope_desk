import { AuthenticatedUser } from '../auth/auth.types';
import { HoursBankService } from '../hours-bank/hours-bank.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsQueryDto, AnalyticsResponse } from './dto/analytics.dto';
export declare class AnalyticsService {
    private readonly prisma;
    private readonly hoursBank;
    constructor(prisma: PrismaService, hoursBank: HoursBankService);
    getAnalytics(user: AuthenticatedUser, query: AnalyticsQueryDto): Promise<AnalyticsResponse>;
    private scopedTicketWhere;
    private resolvePeriod;
    private loadPeriodActivities;
    private loadAvailableYears;
    private loadBacklog;
    private loadTrend;
    private loadPaidHoursInPeriod;
}
