import { AuthenticatedUser } from '../auth/auth.types';
import { ParametersService } from '../parameters/parameters.service';
import { PrismaService } from '../prisma/prisma.service';
import { HoursBankQueryDto, HoursBankResponse, MonthlyHoursSummaryResponse } from './dto/hours-bank.dto';
export declare class HoursBankService {
    private readonly prisma;
    private readonly parameters;
    constructor(prisma: PrismaService, parameters: ParametersService);
    getHoursBank(user: AuthenticatedUser, query: HoursBankQueryDto): Promise<HoursBankResponse>;
    getMonthlySummary(user: AuthenticatedUser, query: HoursBankQueryDto): Promise<MonthlyHoursSummaryResponse>;
    private loadActivitiesForUser;
    private loadExternalTicketActivities;
    private loadPayments;
    private resolveReference;
}
