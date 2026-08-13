import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ParametersService } from '../parameters/parameters.service';
import { PrismaService } from '../prisma/prisma.service';
export interface ReportCompanyHeader {
    companyName: string;
    companyAddress: string;
    companyLogo: string;
}
export interface ActivityReportActivityRow {
    startedAt: string;
    endedAt: string;
    periodStartedAt: string;
    periodEndedAt: string;
    startedLabel: string;
    endedLabel: string;
    technicianName: string;
    notes: string;
    hours: number;
}
export interface ActivityReportTicketRow {
    ticketId: number;
    title: string;
    description: string;
    status: string;
    clientName: string;
    assignedTechnician: string;
    moduleName: string;
    createdAt: string;
    createdLabel: string;
    totalHours: number;
    activities: ActivityReportActivityRow[];
}
export interface TechnicianTotal {
    technicianName: string;
    hours: number;
}
export interface ActivityReport {
    periodStart: string;
    periodEnd: string;
    periodStartLabel: string;
    periodEndLabel: string;
    company: ReportCompanyHeader;
    tickets: ActivityReportTicketRow[];
    totalsByTechnician: TechnicianTotal[];
    totalHours: number;
}
export interface ServicesReportRow {
    ticketId: number;
    lastActivityAt: string;
    lastActivityLabel: string;
    title: string;
    service: string;
    status: string;
    clientName: string;
    technicianName: string;
    hours: number;
}
export interface ServicesReport {
    year: number;
    month: number;
    periodLabel: string;
    company: ReportCompanyHeader;
    rows: ServicesReportRow[];
    totalHours: number;
}
export declare class ReportsService {
    private readonly prisma;
    private readonly parameters;
    constructor(prisma: PrismaService, parameters: ParametersService);
    buildActivityReport(user: AuthenticatedUser, startRaw: string | undefined, endRaw: string | undefined): Promise<ActivityReport>;
    buildServicesReport(user: AuthenticatedUser, year: number | undefined, month: number | undefined): Promise<ServicesReport>;
    private loadCompanyHeader;
    private resolveDatePeriod;
    private parseDay;
}
export type { Prisma };
