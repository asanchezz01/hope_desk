/// <reference types="node" />
/// <reference types="node" />
import { ActivityReport, ServicesReport } from './reports.service';
export declare class ReportPdfService {
    private readonly logger;
    private readonly colors;
    renderActivityReport(report: ActivityReport): Promise<Buffer>;
    renderServicesReport(report: ServicesReport): Promise<Buffer>;
    private collect;
    private drawHeader;
    private tryDrawLogo;
    private drawTableHeader;
    private drawTableRow;
    private ensureSpace;
}
