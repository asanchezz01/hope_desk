"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const report_dto_1 = require("./dto/report.dto");
const report_pdf_service_1 = require("./report-pdf.service");
const reports_service_1 = require("./reports.service");
let ReportsController = class ReportsController {
    constructor(reportsService, pdfService) {
        this.reportsService = reportsService;
        this.pdfService = pdfService;
    }
    getActivityReport(user, query) {
        return this.reportsService.buildActivityReport(user, query.start, query.end);
    }
    async getActivityReportPdf(user, query, response) {
        const report = await this.reportsService.buildActivityReport(user, query.start, query.end);
        const pdf = await this.pdfService.renderActivityReport(report);
        response.setHeader('Content-Type', 'application/pdf');
        response.setHeader('Content-Disposition', `attachment; filename="relatorio-atividades-${sanitize(report.periodStartLabel)}-a-${sanitize(report.periodEndLabel)}.pdf"`);
        response.setHeader('Content-Length', pdf.length);
        response.end(pdf);
    }
    getServicesReport(user, query) {
        return this.reportsService.buildServicesReport(user, query.year, query.month);
    }
    async getServicesReportPdf(user, query, response) {
        const report = await this.reportsService.buildServicesReport(user, query.year, query.month);
        const pdf = await this.pdfService.renderServicesReport(report);
        response.setHeader('Content-Type', 'application/pdf');
        response.setHeader('Content-Disposition', `attachment; filename="demonstrativo-servicos-${report.year}-${String(report.month).padStart(2, '0')}.pdf"`);
        response.setHeader('Content-Length', pdf.length);
        response.end(pdf);
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, common_1.Get)('activities'),
    (0, swagger_1.ApiOperation)({
        summary: 'Relatório de atividades por intervalo (JSON)',
        description: 'Atividades agrupadas por chamado, com recorte proporcional pelo período ' +
            'e totais por técnico. A data final é inclusiva.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Relatório em JSON.' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, report_dto_1.ActivityReportQueryDto]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getActivityReport", null);
__decorate([
    (0, common_1.Get)('activities.pdf'),
    (0, swagger_1.ApiOperation)({ summary: 'Relatório de atividades por intervalo (PDF)' }),
    (0, swagger_1.ApiProduces)('application/pdf'),
    (0, common_1.Header)('Content-Type', 'application/pdf'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, report_dto_1.ActivityReportQueryDto, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getActivityReportPdf", null);
__decorate([
    (0, common_1.Get)('services'),
    (0, swagger_1.ApiOperation)({
        summary: 'Demonstrativo mensal de serviços (JSON)',
        description: 'Uma linha por atividade do mês, ordenada pelo fim decrescente.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Demonstrativo em JSON.' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, report_dto_1.ServicesReportQueryDto]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getServicesReport", null);
__decorate([
    (0, common_1.Get)('services.pdf'),
    (0, swagger_1.ApiOperation)({ summary: 'Demonstrativo mensal de serviços (PDF)' }),
    (0, swagger_1.ApiProduces)('application/pdf'),
    (0, common_1.Header)('Content-Type', 'application/pdf'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, report_dto_1.ServicesReportQueryDto, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getServicesReportPdf", null);
exports.ReportsController = ReportsController = __decorate([
    (0, swagger_1.ApiTags)('reports'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('reports'),
    __metadata("design:paramtypes", [reports_service_1.ReportsService,
        report_pdf_service_1.ReportPdfService])
], ReportsController);
function sanitize(value) {
    return value.replace(/[^0-9A-Za-z-]/g, '-');
}
//# sourceMappingURL=reports.controller.js.map