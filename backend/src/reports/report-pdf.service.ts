import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { ActivityReport, ServicesReport } from './reports.service';

/**
 * Geração de PDF dos relatórios.
 *
 * O legado usa ReportLab; aqui usamos PDFKit. O layout não é idêntico ao
 * milímetro — o que é preservado são os **dados**, os totais e o cabeçalho com
 * nome, endereço e logo da empresa.
 *
 * O logo é resolvido de `company_logo`, que aceita URL http(s) ou caminho de
 * arquivo. Diferente do legado, **não buscamos URL remota**: um `urlopen`
 * síncrono dentro do request é um risco de SSRF e de travamento. URLs são
 * ignoradas com aviso em log; caminhos locais são lidos do disco.
 */
@Injectable()
export class ReportPdfService {
  private readonly logger = new Logger(ReportPdfService.name);

  private readonly colors = {
    primary: '#0c4e9a',
    secondary: '#234783',
    accent: '#ffcc00',
    text: '#1f2937',
    muted: '#6b7280',
    line: '#d1d5db',
    zebra: '#f3f4f6',
  };

  /** Relatório de atividades por intervalo, agrupado por chamado. */
  async renderActivityReport(report: ActivityReport): Promise<Buffer> {
    const document = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks = this.collect(document);

    this.drawHeader(
      document,
      report.company,
      'Relatório de Atividades',
      `Período: ${report.periodStartLabel} a ${report.periodEndLabel}`,
    );

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
        .text(
          `Cliente: ${ticket.clientName}   |   Módulo: ${ticket.moduleName}   |   ` +
            `Status: ${ticket.status}   |   Técnico: ${ticket.assignedTechnician}   |   ` +
            `Aberto em: ${ticket.createdLabel}`,
        );

      document.moveDown(0.3);

      const columns = [
        { header: 'Início', width: 95 },
        { header: 'Fim', width: 95 },
        { header: 'Técnico', width: 110 },
        { header: 'Atividade', width: 145 },
        { header: 'Horas', width: 45, align: 'right' as const },
      ];

      this.drawTableHeader(document, columns);

      let zebra = false;
      for (const activity of ticket.activities) {
        this.ensureSpace(document, 30);
        this.drawTableRow(
          document,
          columns,
          [
            activity.startedLabel,
            activity.endedLabel,
            activity.technicianName,
            activity.notes,
            activity.hours.toFixed(2).replace('.', ','),
          ],
          zebra,
        );
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
        { header: 'Horas', width: 90, align: 'right' as const },
      ];
      this.drawTableHeader(document, columns);

      let zebra = false;
      for (const item of report.totalsByTechnician) {
        this.ensureSpace(document, 30);
        this.drawTableRow(
          document,
          columns,
          [item.technicianName, item.hours.toFixed(2).replace('.', ',')],
          zebra,
        );
        zebra = !zebra;
      }
    }

    document.moveDown(0.8);
    document
      .fontSize(12)
      .fillColor(this.colors.primary)
      .text(
        `Total geral do período: ${report.totalHours.toFixed(2).replace('.', ',')} h`,
        { align: 'right' },
      );

    document.end();
    return chunks;
  }

  /** Demonstrativo mensal de serviços, uma linha por atividade. */
  async renderServicesReport(report: ServicesReport): Promise<Buffer> {
    const document = new PDFDocument({ size: 'A4', margin: 36, layout: 'landscape' });
    const chunks = this.collect(document);

    this.drawHeader(
      document,
      report.company,
      'Demonstrativo de Serviços',
      `Referência: ${report.periodLabel}`,
    );

    const columns = [
      { header: 'Chamado', width: 60 },
      { header: 'Última atividade', width: 105 },
      { header: 'Título', width: 150 },
      { header: 'Serviço', width: 200 },
      { header: 'Status', width: 85 },
      { header: 'Cliente', width: 110 },
      { header: 'Técnico', width: 110 },
      { header: 'Horas', width: 45, align: 'right' as const },
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
      this.drawTableRow(
        document,
        columns,
        [
          `#${row.ticketId}`,
          row.lastActivityLabel,
          row.title,
          row.service,
          row.status,
          row.clientName,
          row.technicianName,
          row.hours.toFixed(2).replace('.', ','),
        ],
        zebra,
      );
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

  // -------------------------------------------------------------------------

  private collect(document: PDFKit.PDFDocument): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise<Buffer>((resolve, reject) => {
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
    });
  }

  private drawHeader(
    document: PDFKit.PDFDocument,
    company: { companyName: string; companyAddress: string; companyLogo: string },
    title: string,
    subtitle: string,
  ): void {
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

  /**
   * Desenha o logo se `company_logo` for um caminho local legível.
   *
   * URLs remotas são deliberadamente ignoradas: buscá-las de dentro do request
   * seria SSRF e um ponto de travamento. Devolve a largura ocupada.
   */
  private tryDrawLogo(document: PDFKit.PDFDocument, logoReference: string): number {
    const reference = (logoReference ?? '').trim();
    if (!reference) return 0;

    if (/^https?:\/\//i.test(reference)) {
      this.logger.warn(
        'company_logo aponta para URL remota; ignorado no PDF por segurança. ' +
          'Use um arquivo local.',
      );
      return 0;
    }

    try {
      document.image(reference, document.page.margins.left, document.page.margins.top, {
        fit: [90, 45],
      });
      return 105;
    } catch (error) {
      this.logger.warn(
        `Falha ao carregar o logo "${reference}": ${(error as Error).message}`,
      );
      return 0;
    }
  }

  private drawTableHeader(
    document: PDFKit.PDFDocument,
    columns: { header: string; width: number; align?: 'left' | 'right' }[],
  ): void {
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

  private drawTableRow(
    document: PDFKit.PDFDocument,
    columns: { width: number; align?: 'left' | 'right' }[],
    values: string[],
    zebra: boolean,
  ): void {
    const top = document.y;
    const totalWidth = columns.reduce((total, column) => total + column.width, 0);

    // Altura calculada pelo conteúdo mais alto, para não cortar texto longo.
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

  /** Quebra a página quando não há espaço para o próximo bloco. */
  private ensureSpace(document: PDFKit.PDFDocument, needed: number): void {
    const bottom = document.page.height - document.page.margins.bottom;
    if (document.y + needed > bottom) {
      document.addPage();
    }
  }
}
