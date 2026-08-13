import type { Response } from 'express';
import { AuthenticatedUser } from '../auth/auth.types';
import { ActivityReportQueryDto, ServicesReportQueryDto } from './dto/report.dto';
import { ReportPdfService } from './report-pdf.service';
import { ReportsService } from './reports.service';
export declare class ReportsController {
    private readonly reportsService;
    private readonly pdfService;
    constructor(reportsService: ReportsService, pdfService: ReportPdfService);
    getActivityReport(user: AuthenticatedUser, query: ActivityReportQueryDto): Promise<import("./reports.service").ActivityReport>;
    getActivityReportPdf(user: AuthenticatedUser, query: ActivityReportQueryDto, response: Response): Promise<void>;
    getServicesReport(user: AuthenticatedUser, query: ServicesReportQueryDto): Promise<import("./reports.service").ServicesReport>;
    getServicesReportPdf(user: AuthenticatedUser, query: ServicesReportQueryDto, response: Response): Promise<void>;
}
