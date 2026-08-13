"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var ReportPdfService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportPdfService = void 0;
const common_1 = require("@nestjs/common");
const pdfkit_1 = __importDefault(require("pdfkit"));
let ReportPdfService = ReportPdfService_1 = class ReportPdfService {
    constructor() {
        this.logger = new common_1.Logger(ReportPdfService_1.name);
        this.colors = {
            primary: '#0c4e9a',
            secondary: '#234783',
            accent: '#ffcc00',
            text: '#1f2937',
            muted: '#6b7280',
            line: '#d1d5db',
            zebra: '#f3f4f6',
        };
    }
    async renderActivityReport(report) {
        const document = new pdfkit_1.default({ size: 'A4', margin: 36 });
        const chunks = this.collect(document);
        this.drawHeader(document, report.company, 'Relatório de Atividades', `Período: ${report.periodStartLabel} a ${report.periodEndLabel}`);
        if (report.tickets.length === 0) {
            document
                .fontSize(11)
                .fillColor(this.colors.muted)
                .text('Nenhuma atividade registrada no período.', { align: 'center' });
        }
        for (const ticket of report.tickets) {
            this.ensureSpace(document, 120);
            document
                .fontSize(11)
                .fillColor(this.colors.primary)
                .text(`Chamado #${ticket.ticketId} — ${ticket.title}`);
            document
                .fontSize(8.5)
                .fillColor(this.colors.muted)
                .text(`Cliente: ${ticket.clientName}   |   Módulo: ${ticket.moduleName}   |   ` +
                `Status: ${ticket.status}   |   Técnico: ${ticket.assignedTechnician}   |   ` +
                `Aberto em: ${ticket.createdLabel}`);
            document.moveDown(0.3);
            const columns = [
                { header: 'Início', width: 95 },
                { header: 'Fim', width: 95 },
                { header: 'Técnico', width: 110 },
                { header: 'Atividade', width: 145 },
                { header: 'Horas', width: 45, align: 'right' },
            ];
            this.drawTableHeader(document, columns);
            let zebra = false;
            for (const activity of ticket.activities) {
                this.ensureSpace(document, 30);
                this.drawTableRow(document, columns, [
                    activity.startedLabel,
                    activity.endedLabel,
                    activity.technicianName,
                    activity.notes,
                    activity.hours.toFixed(2).replace('.', ','),
                ], zebra);
                zebra = !zebra;
            }
            document.moveDown(0.2);
            document
                .fontSize(9)
                .fillColor(this.colors.secondary)
                .text(`Total do chamado: ${ticket.totalHours.toFixed(2).replace('.', ',')} h`, {
                align: 'right',
            });
            document.moveDown(0.6);
        }
        if (report.totalsByTechnician.length > 0) {
            this.ensureSpace(document, 120);
            document.moveDown(0.5);
            document.fontSize(11).fillColor(this.colors.primary).text('Totais por técnico');
            document.moveDown(0.3);
            const columns = [
                { header: 'Técnico', width: 300 },
                { header: 'Horas', width: 90, align: 'right' },
            ];
            this.drawTableHeader(document, columns);
            let zebra = false;
            for (const item of report.totalsByTechnician) {
                this.ensureSpace(document, 30);
                this.drawTableRow(document, columns, [item.technicianName, item.hours.toFixed(2).replace('.', ',')], zebra);
                zebra = !zebra;
            }
        }
        document.moveDown(0.8);
        document
            .fontSize(12)
            .fillColor(this.colors.primary)
            .text(`Total geral do período: ${report.totalHours.toFixed(2).replace('.', ',')} h`, { align: 'right' });
        document.end();
        return chunks;
    }
    async renderServicesReport(report) {
        const document = new pdfkit_1.default({ size: 'A4', margin: 36, layout: 'landscape' });
        const chunks = this.collect(document);
        this.drawHeader(document, report.company, 'Demonstrativo de Serviços', `Referência: ${report.periodLabel}`);
        const columns = [
            { header: 'Chamado', width: 60 },
            { header: 'Última atividade', width: 105 },
            { header: 'Título', width: 150 },
            { header: 'Serviço', width: 200 },
            { header: 'Status', width: 85 },
            { header: 'Cliente', width: 110 },
            { header: 'Técnico', width: 110 },
            { header: 'Horas', width: 45, align: 'right' },
        ];
        this.drawTableHeader(document, columns);
        if (report.rows.length === 0) {
            document.moveDown(0.5);
            document
                .fontSize(11)
                .fillColor(this.colors.muted)
                .text('Nenhum serviço registrado no período.', { align: 'center' });
        }
        let zebra = false;
        for (const row of report.rows) {
            this.ensureSpace(document, 30);
            this.drawTableRow(document, columns, [
                `#${row.ticketId}`,
                row.lastActivityLabel,
                row.title,
                row.service,
                row.status,
                row.clientName,
                row.technicianName,
                row.hours.toFixed(2).replace('.', ','),
            ], zebra);
            zebra = !zebra;
        }
        document.moveDown(0.8);
        document
            .fontSize(12)
            .fillColor(this.colors.primary)
            .text(`Total de horas: ${report.totalHours.toFixed(2).replace('.', ',')} h`, {
            align: 'right',
        });
        document.end();
        return chunks;
    }
    collect(document) {
        const chunks = [];
        return new Promise((resolve, reject) => {
            document.on('data', (chunk) => chunks.push(chunk));
            document.on('end', () => resolve(Buffer.concat(chunks)));
            document.on('error', reject);
        });
    }
    drawHeader(document, company, title, subtitle) {
        const logoWidth = this.tryDrawLogo(document, company.companyLogo);
        const textLeft = document.page.margins.left + logoWidth;
        document
            .fontSize(15)
            .fillColor(this.colors.primary)
            .text(company.companyName, textLeft, document.page.margins.top);
        document
            .fontSize(9)
            .fillColor(this.colors.muted)
            .text(company.companyAddress, textLeft);
        document.moveDown(0.6);
        document.fontSize(13).fillColor(this.colors.text).text(title, textLeft);
        document.fontSize(9.5).fillColor(this.colors.secondary).text(subtitle, textLeft);
        document.moveDown(0.5);
        const lineY = document.y;
        document
            .moveTo(document.page.margins.left, lineY)
            .lineTo(document.page.width - document.page.margins.right, lineY)
            .lineWidth(1.5)
            .strokeColor(this.colors.accent)
            .stroke();
        document.moveDown(0.8);
        document.x = document.page.margins.left;
    }
    tryDrawLogo(document, logoReference) {
        const reference = (logoReference ?? '').trim();
        if (!reference)
            return 0;
        if (/^https?:\/\//i.test(reference)) {
            this.logger.warn('company_logo aponta para URL remota; ignorado no PDF por segurança. ' +
                'Use um arquivo local.');
            return 0;
        }
        try {
            document.image(reference, document.page.margins.left, document.page.margins.top, {
                fit: [90, 45],
            });
            return 105;
        }
        catch (error) {
            this.logger.warn(`Falha ao carregar o logo "${reference}": ${error.message}`);
            return 0;
        }
    }
    drawTableHeader(document, columns) {
        const top = document.y;
        const totalWidth = columns.reduce((total, column) => total + column.width, 0);
        document
            .rect(document.page.margins.left, top, totalWidth, 18)
            .fillColor(this.colors.secondary)
            .fill();
        let x = document.page.margins.left;
        document.fontSize(8.5).fillColor('#ffffff');
        for (const column of columns) {
            document.text(column.header, x + 4, top + 5, {
                width: column.width - 8,
                align: column.align ?? 'left',
            });
            x += column.width;
        }
        document.y = top + 18;
        document.x = document.page.margins.left;
    }
    drawTableRow(document, columns, values, zebra) {
        const top = document.y;
        const totalWidth = columns.reduce((total, column) => total + column.width, 0);
        let rowHeight = 14;
        document.fontSize(8);
        columns.forEach((column, index) => {
            const height = document.heightOfString(values[index] ?? '', {
                width: column.width - 8,
            });
            rowHeight = Math.max(rowHeight, height + 8);
        });
        if (zebra) {
            document
                .rect(document.page.margins.left, top, totalWidth, rowHeight)
                .fillColor(this.colors.zebra)
                .fill();
        }
        let x = document.page.margins.left;
        document.fontSize(8).fillColor(this.colors.text);
        columns.forEach((column, index) => {
            document.text(values[index] ?? '', x + 4, top + 4, {
                width: column.width - 8,
                align: column.align ?? 'left',
            });
            x += column.width;
        });
        document
            .moveTo(document.page.margins.left, top + rowHeight)
            .lineTo(document.page.margins.left + totalWidth, top + rowHeight)
            .lineWidth(0.4)
            .strokeColor(this.colors.line)
            .stroke();
        document.y = top + rowHeight;
        document.x = document.page.margins.left;
    }
    ensureSpace(document, needed) {
        const bottom = document.page.height - document.page.margins.bottom;
        if (document.y + needed > bottom) {
            document.addPage();
        }
    }
};
exports.ReportPdfService = ReportPdfService;
exports.ReportPdfService = ReportPdfService = ReportPdfService_1 = __decorate([
    (0, common_1.Injectable)()
], ReportPdfService);
//# sourceMappingURL=report-pdf.service.js.map