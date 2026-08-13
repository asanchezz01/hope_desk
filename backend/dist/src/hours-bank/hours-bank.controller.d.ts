import { AuthenticatedUser } from '../auth/auth.types';
import { HoursBankQueryDto, HoursBankResponse, MonthlyHoursSummaryResponse } from './dto/hours-bank.dto';
import { HoursBankService } from './hours-bank.service';
export declare class HoursBankController {
    private readonly hoursBankService;
    constructor(hoursBankService: HoursBankService);
    getHoursBank(user: AuthenticatedUser, query: HoursBankQueryDto): Promise<HoursBankResponse>;
    getMonthlySummary(user: AuthenticatedUser, query: HoursBankQueryDto): Promise<MonthlyHoursSummaryResponse>;
}
