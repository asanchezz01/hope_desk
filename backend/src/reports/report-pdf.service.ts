import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { ActivityReport, ReportBrandColors, ServicesReport } from './reports.service';

type TableColumn = {
  header: string;
  width: number;
  align?: 'left' | 'right';
};

type PdfColors = {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  muted: string;
  line: string;
  zebra: string;
  activity: string;
  summary: string;
};

/**
 * Geração de PDF dos relatórios.
 *
 * O legado usa ReportLab; aqui usamos PDFKit. O layout não é idêntico ao
 * milímetro — o que é preservado são os **dados**, os totais e o cabeçalho com
 * nome, endereço e logo da empresa.
 *
 * O logo é resolvido de `report_logo`, independente das logos da interface,
 * e aceita URL http(s) ou caminho de
 * arquivo. Diferente do legado, **não buscamos URL remota**: um `urlopen`
 * síncrono dentro do request é um risco de SSRF e de travamento. URLs são
 * ignoradas com aviso em log; caminhos locais são lidos do disco.
 */
/**
 * Caixa máxima do logo no cabeçalho do relatório, em pontos.
 *
 * O dobro da caixa do legado (90 x 45), e metade do que chegou a ser usado
 * (360 x 180): naquele tamanho a marca tomava um terço da primeira página e
 * empurrava a tabela para baixo. É uma caixa MÁXIMA — a imagem é encaixada
 * dentro dela preservando a proporção, nunca esticada.
 */
const LOGO_BOX = { width: 180, height: 90 } as const;

@Injectable()
export class ReportPdfService {
  private readonly logger = new Logger(ReportPdfService.name);

  /**
   * Padrão visual da retaguarda NewHope, em papel. Os degraus são os mesmos do
   * preset compartilhado (ver `frontend/src/theme/tokens.ts`): o PDF sai da
   * mesma paleta da tela, senão o relatório impresso denuncia o produto antigo.
   * Só o modo claro existe aqui — papel não tem tema escuro.
   */
  private readonly defaultColors: PdfColors = {
    primary: '#0d7f57', // brand-700
    secondary: '#203753', // slate-800
    accent: '#a2600b', // accent-600
    text: '#0c192a', // slate-900
    muted: '#576d84', // slate-500
    line: '#dce5ec', // slate-200
    zebra: '#f5f8fa', // slate-50
    activity: '#e9f7f1', // brand-50
    summary: '#eef3f8', // slate-100
  };

  /** Cada PDF carrega a própria paleta; o serviço Nest é compartilhado entre requests. */
  private readonly colorsByDocument = new WeakMap<PDFKit.PDFDocument, PdfColors>();

  /**
   * Paleta do documento corrente.
   *
   * O `WeakMap` existe porque o serviço é um singleton do Nest e dois
   * relatórios podem ser gerados ao mesmo tempo: guardar a paleta num campo de
   * instância faria um request pintar com as cores do outro. Sem entrada
   * registrada — só acontece em teste, que chama um `draw*` isolado — vale o
   * padrão.
   */
  private colorsFor(document: PDFKit.PDFDocument): PdfColors {
    return this.colorsByDocument.get(document) ?? this.defaultColors;
  }

  /**
   * Traduz a identidade visual da empresa na paleta do papel.
   *
   * Só três das cinco cores da identidade entram: `primary`, `secondary` e
   * `accent`. `info` e `danger` não têm elemento correspondente no relatório —
   * não há aviso nem erro impresso —, e inventar um uso para elas coloriria o
   * documento sem que ninguém tenha pedido.
   *
   * Os NEUTROS de papel (texto, apagado, filete, zebra, resumo) ficam fixos: são
   * a escala cinza-azulada do padrão da retaguarda e não pertencem à marca da
   * empresa. Trocá-los junto com a cor principal produziria um documento de
   * contraste imprevisível — que é justamente o que a paleta fixa evita.
   *
   * Cor inválida cai no padrão em vez de derrubar o relatório: o DTO valida o
   * formato na gravação, mas linhas antigas (ou escritas direto no banco) podem
   * trazer qualquer coisa, e `fillColor` lança com valor que não entende.
   */
  private resolveColors(brand: ReportBrandColors): PdfColors {
    const primary = hexOrFallback(brand.primaryColor, this.defaultColors.primary);

    return {
      ...this.defaultColors,
      primary,
      secondary: hexOrFallback(brand.secondaryColor, this.defaultColors.secondary),
      accent: hexOrFallback(brand.accentColor, this.defaultColors.accent),
      // A faixa do bloco de atividades é a principal CLAREADA, e não uma cor à
      // parte: fixá-la deixaria uma tarja verde num relatório de marca roxa.
      activity: lighten(primary, 0.92),
    };
  }

  /** Relatório de atividades por intervalo, agrupado por chamado. */
  async renderActivityReport(report: ActivityReport): Promise<Buffer> {
    const document = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks = this.collect(document);
    this.colorsByDocument.set(document, this.resolveColors(report.company.colors));
    const colors = this.colorsFor(document);

    this.drawHeader(
      document,
      report.company,
      'Relatório de Atividades',
      `Período: ${report.periodStartLabel} a ${report.periodEndLabel}`,
    );

    if (report.tickets.length === 0) {
      document
        .fontSize(11)
        .fillColor(colors.muted)
        .text('Nenhuma atividade registrada no período.', { align: 'center' });
    }

    for (const ticket of report.tickets) {
      this.ensureSpace(document, 120);

      document
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(colors.primary)
        .text(`Chamado #${ticket.ticketId} — ${ticket.title}`);

      document
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(colors.muted)
        .text(
          `Cliente: ${ticket.clientName}   |   Módulo: ${ticket.moduleName}   |   Status: ${ticket.status}`,
        )
        .text(
          `Técnico responsável: ${ticket.assignedTechnician}   |   Aberto em: ${ticket.createdLabel}`,
        );

      document.moveDown(0.3);

      const columns = [
        { header: 'Início', width: 120 },
        { header: 'Fim', width: 120 },
        { header: 'Técnico', width: 216 },
        { header: 'Horas', width: 67, align: 'right' as const },
      ] satisfies TableColumn[];

      this.drawTableHeader(document, columns);

      let zebra = false;
      for (const activity of ticket.activities) {
        this.drawActivityRow(
          document,
          columns,
          activity,
          zebra,
          `Chamado #${ticket.ticketId} — ${ticket.title}`,
        );
        zebra = !zebra;
      }

      document.moveDown(0.2);
      document
        .fontSize(9)
        .fillColor(colors.secondary)
        .text(`Total do chamado: ${ticket.totalHours.toFixed(2).replace('.', ',')} h`, {
          align: 'right',
        });
      document.moveDown(0.6);
    }

    if (report.totalsByTechnician.length > 0) {
      this.ensureSpace(document, 120);
      document.moveDown(0.5);
      document.fontSize(11).fillColor(colors.primary).text('Totais por técnico');
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

    this.drawActivityReportSummary(document, report);

    document.end();
    return chunks;
  }

  /** Demonstrativo mensal de serviços, em um bloco de duas linhas por atividade. */
  async renderServicesReport(report: ServicesReport): Promise<Buffer> {
    const document = new PDFDocument({ size: 'A4', margin: 36, layout: 'landscape' });
    const chunks = this.collect(document);
    this.colorsByDocument.set(document, this.resolveColors(report.company.colors));
    const colors = this.colorsFor(document);

    this.drawHeader(
      document,
      report.company,
      'Demonstrativo de Serviços',
      `Referência: ${report.periodLabel}`,
    );

    const columns = [
      { header: 'Chamado', width: 58 },
      { header: 'Última atividade', width: 105 },
      { header: 'Cliente', width: 110 },
      { header: 'Técnico', width: 105 },
      { header: 'Status', width: 82 },
      { header: 'Título', width: 308 },
    ] satisfies TableColumn[];

    this.drawTableHeader(document, columns);

    if (report.rows.length === 0) {
      document.moveDown(0.5);
      document
        .fontSize(11)
        .fillColor(colors.muted)
        .text('Nenhum serviço registrado no período.', { align: 'center' });
    }

    let zebra = false;
    for (const row of report.rows) {
      this.drawServiceRow(document, columns, row, zebra);
      zebra = !zebra;
    }

    document.moveDown(0.8);
    document
      .fontSize(12)
      .fillColor(colors.primary)
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
    const colors = this.colorsFor(document);
    const logoHeight = this.tryDrawLogo(document, company.companyLogo);

    if (logoHeight === 0) {
      document
        .fontSize(15)
        .fillColor(colors.primary)
        .text(
          company.companyName,
          document.page.margins.left,
          document.page.margins.top,
        );

      document
        .fontSize(9)
        .fillColor(colors.muted)
        .text(company.companyAddress, document.page.margins.left);
    } else {
      // A logo específica do relatório é a identidade do documento; não
      // repetimos nome ou endereço da empresa ao lado dela.
      document.y = document.page.margins.top + logoHeight + 12;
    }

    document.moveDown(0.6);
    document
      .fontSize(13)
      .fillColor(colors.text)
      .text(title, document.page.margins.left);
    document
      .fontSize(9.5)
      .fillColor(colors.secondary)
      .text(subtitle, document.page.margins.left);

    document.moveDown(0.5);
    const lineY = document.y;
    document
      .moveTo(document.page.margins.left, lineY)
      .lineTo(document.page.width - document.page.margins.right, lineY)
      .lineWidth(1.5)
      .strokeColor(colors.accent)
      .stroke();
    document.moveDown(0.8);
    document.x = document.page.margins.left;
  }

  /**
   * Desenha o logo se `report_logo` for um caminho local legível.
   *
   * URLs remotas são deliberadamente ignoradas: buscá-las de dentro do request
   * seria SSRF e um ponto de travamento. Devolve a altura REALMENTE ocupada
   * pela imagem — ver a nota em `LOGO_BOX`.
   */
  private tryDrawLogo(document: PDFKit.PDFDocument, logoReference: string): number {
    const reference = (logoReference ?? '').trim();
    if (!reference) return 0;

    if (/^https?:\/\//i.test(reference)) {
      this.logger.warn(
        'report_logo aponta para URL remota; ignorado no PDF por segurança. ' +
          'Use um arquivo local.',
      );
      return 0;
    }

    try {
      // `openImage` existe no PDFKit desde a 0.11 mas não está em
      // @types/pdfkit; daí o cast. Ele lê o cabeçalho da imagem e guarda o
      // resultado em cache pelo caminho, então o `image()` abaixo reaproveita
      // a mesma decodificação. Se o arquivo não for uma imagem que o PDFKit
      // entenda (SVG, por exemplo), lança — e cai no `catch` de sempre.
      const { width, height } = (
        document as unknown as {
          openImage(src: string): { width: number; height: number };
        }
      ).openImage(reference);

      document.image(reference, document.page.margins.left, document.page.margins.top, {
        fit: [LOGO_BOX.width, LOGO_BOX.height],
      });

      return logoDrawnHeight(width, height);
    } catch (error) {
      this.logger.warn(
        `Falha ao carregar o logo "${reference}": ${(error as Error).message}`,
      );
      return 0;
    }
  }

  private drawTableHeader(document: PDFKit.PDFDocument, columns: TableColumn[]): void {
    const colors = this.colorsFor(document);
    const top = document.y;
    const totalWidth = columns.reduce((total, column) => total + column.width, 0);

    document
      .rect(document.page.margins.left, top, totalWidth, 18)
      .fillColor(colors.secondary)
      .fill();

    let x = document.page.margins.left;
    document.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff');
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
    columns: TableColumn[],
    values: string[],
    zebra: boolean,
  ): void {
    const colors = this.colorsFor(document);
    const top = document.y;
    const totalWidth = columns.reduce((total, column) => total + column.width, 0);

    // Altura calculada pelo conteúdo mais alto, para não cortar texto longo.
    let rowHeight = 14;
    document.font('Helvetica').fontSize(8);
    columns.forEach((column, index) => {
      const height = document.heightOfString(values[index] ?? '', {
        width: column.width - 8,
      });
      rowHeight = Math.max(rowHeight, height + 8);
    });

    if (zebra) {
      document
        .rect(document.page.margins.left, top, totalWidth, rowHeight)
        .fillColor(colors.zebra)
        .fill();
    }

    let x = document.page.margins.left;
    document.font('Helvetica').fontSize(8).fillColor(colors.text);
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
      .strokeColor(colors.line)
      .stroke();

    document.y = top + rowHeight;
    document.x = document.page.margins.left;
  }

  /**
   * Mantém os dados temporais em uma linha compacta e reserva uma segunda faixa,
   * de largura total, para a descrição da atividade. Assim as informações
   * continuam visualmente ligadas ao chamado sem comprimir o texto principal.
   */
  private drawActivityRow(
    document: PDFKit.PDFDocument,
    columns: TableColumn[],
    activity: ActivityReport['tickets'][number]['activities'][number],
    zebra: boolean,
    ticketLabel: string,
  ): void {
    const colors = this.colorsFor(document);
    const totalWidth = columns.reduce((total, column) => total + column.width, 0);
    const values = [
      activity.startedLabel,
      activity.endedLabel,
      activity.technicianName,
      activity.hours.toFixed(2).replace('.', ','),
    ];

    document.font('Helvetica').fontSize(8);
    let detailsHeight = 22;
    columns.forEach((column, index) => {
      detailsHeight = Math.max(
        detailsHeight,
        document.heightOfString(values[index] ?? '', {
          width: column.width - 8,
        }) + 8,
      );
    });

    const labelWidth = 58;
    const notesWidth = totalWidth - labelWidth - 12;
    const notesFontSize = this.fitSingleLineFontSize(
      document,
      activity.notes,
      notesWidth,
      8.5,
      6.5,
    );
    document.font('Helvetica').fontSize(notesFontSize);
    const notesHeight = Math.max(
      22,
      document.heightOfString(activity.notes, { width: notesWidth }) + 10,
    );
    const blockHeight = detailsHeight + notesHeight;

    const bottom = document.page.height - document.page.margins.bottom;
    if (document.y + blockHeight > bottom) {
      document.addPage();
      document
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(colors.primary)
        .text(`${ticketLabel} (continuação)`);
      document.moveDown(0.3);
      this.drawTableHeader(document, columns);
    }
    const top = document.y;

    if (zebra) {
      document
        .rect(document.page.margins.left, top, totalWidth, detailsHeight)
        .fillColor(colors.zebra)
        .fill();
    }

    let x = document.page.margins.left;
    document.font('Helvetica').fontSize(8).fillColor(colors.text);
    columns.forEach((column, index) => {
      document.text(values[index] ?? '', x + 4, top + 6, {
        width: column.width - 8,
        align: column.align ?? 'left',
      });
      x += column.width;
    });

    const activityTop = top + detailsHeight;
    document
      .rect(document.page.margins.left, activityTop, totalWidth, notesHeight)
      .fillColor(colors.activity)
      .fill();

    document
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(colors.secondary)
      .text('ATIVIDADE', document.page.margins.left + 5, activityTop + 6, {
        width: labelWidth - 8,
        lineBreak: false,
      });
    document
      .font('Helvetica')
      .fontSize(notesFontSize)
      .fillColor(colors.text)
      .text(activity.notes, document.page.margins.left + labelWidth, activityTop + 5, {
        width: notesWidth,
      });

    document
      .moveTo(document.page.margins.left, top + blockHeight)
      .lineTo(document.page.margins.left + totalWidth, top + blockHeight)
      .lineWidth(0.4)
      .strokeColor(colors.line)
      .stroke();

    document.y = top + blockHeight;
    document.x = document.page.margins.left;
  }

  /**
   * Cada serviço fica visualmente unido em duas faixas: os dados que permitem
   * identificar o chamado na primeira; na segunda, somente a descrição do
   * serviço, sem comprimí-la em uma coluna estreita.
   */
  private drawServiceRow(
    document: PDFKit.PDFDocument,
    columns: TableColumn[],
    row: ServicesReport['rows'][number],
    zebra: boolean,
  ): void {
    const colors = this.colorsFor(document);
    const totalWidth = columns.reduce((total, column) => total + column.width, 0);
    const metadata = [
      `#${row.ticketId}`,
      row.lastActivityLabel,
      row.clientName,
      row.technicianName,
      row.status,
      row.title,
    ];

    document.font('Helvetica').fontSize(8);
    let metadataHeight = 22;
    columns.forEach((column, index) => {
      metadataHeight = Math.max(
        metadataHeight,
        document.heightOfString(metadata[index] ?? '', { width: column.width - 8 }) + 8,
      );
    });

    const serviceWidth = totalWidth - 16;
    document.font('Helvetica').fontSize(8.5);
    const serviceHeight = Math.max(
      22,
      document.heightOfString(row.service, { width: serviceWidth }) + 10,
    );
    const blockHeight = metadataHeight + serviceHeight;
    const bottom = document.page.height - document.page.margins.bottom;

    if (document.y + blockHeight > bottom) {
      document.addPage();
      this.drawTableHeader(document, columns);
    }

    const top = document.y;
    if (zebra) {
      document
        .rect(document.page.margins.left, top, totalWidth, blockHeight)
        .fillColor(colors.zebra)
        .fill();
    }

    let x = document.page.margins.left;
    document.font('Helvetica').fontSize(8).fillColor(colors.text);
    columns.forEach((column, index) => {
      document.text(metadata[index] ?? '', x + 4, top + 6, {
        width: column.width - 8,
        align: column.align ?? 'left',
      });
      x += column.width;
    });

    const serviceTop = top + metadataHeight;
    document
      .rect(document.page.margins.left, serviceTop, totalWidth, serviceHeight)
      .fillColor(colors.activity)
      .fill();
    document
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(colors.text)
      .text(row.service, document.page.margins.left + 8, serviceTop + 5, {
        width: serviceWidth,
      });

    document
      .moveTo(document.page.margins.left, top + blockHeight)
      .lineTo(document.page.margins.left + totalWidth, top + blockHeight)
      .lineWidth(0.4)
      .strokeColor(colors.line)
      .stroke();

    document.y = top + blockHeight;
    document.x = document.page.margins.left;
  }

  private drawActivityReportSummary(
    document: PDFKit.PDFDocument,
    report: ActivityReport,
  ): void {
    const colors = this.colorsFor(document);
    const width = 270;
    const height = 72;
    this.ensureSpace(document, height + 12);
    document.moveDown(0.8);

    const left = document.page.width - document.page.margins.right - width;
    const top = document.y;
    document.roundedRect(left, top, width, height, 6).fillColor(colors.summary).fill();

    const labelX = left + 12;
    const valueWidth = 120;
    const valueX = left + width - valueWidth - 12;
    const rows = [
      ['Horas trabalhadas', `${report.totalHours.toFixed(2).replace('.', ',')} h`],
      ['Valor da hora', formatCurrency(report.hourlyRate)],
      ['Valor devido', formatCurrency(report.amountDue)],
    ];

    rows.forEach(([label, value], index) => {
      const y = top + 10 + index * 19;
      const isTotal = index === rows.length - 1;
      document
        .font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(isTotal ? 10.5 : 9)
        .fillColor(isTotal ? colors.primary : colors.text)
        .text(label, labelX, y, { width: width - valueWidth - 30, lineBreak: false });
      document.text(value, valueX, y, {
        width: valueWidth,
        align: 'right',
        lineBreak: false,
      });
    });

    document.y = top + height;
    document.x = document.page.margins.left;
  }

  private fitSingleLineFontSize(
    document: PDFKit.PDFDocument,
    text: string,
    width: number,
    preferred: number,
    minimum: number,
  ): number {
    let size = preferred;
    document.font('Helvetica');
    while (size > minimum) {
      document.fontSize(size);
      if (document.widthOfString(text) <= width) break;
      size -= 0.25;
    }
    return Math.max(size, minimum);
  }

  /** Quebra a página quando não há espaço para o próximo bloco. */
  private ensureSpace(document: PDFKit.PDFDocument, needed: number): void {
    const bottom = document.page.height - document.page.margins.bottom;
    if (document.y + needed > bottom) {
      document.addPage();
    }
  }
}

/**
 * Altura que a imagem realmente ocupa dentro de `LOGO_BOX`.
 *
 * `fit` do PDFKit encaixa a imagem na caixa PRESERVANDO a proporção, então a
 * altura desenhada quase nunca é a altura da caixa: uma logo deitada de 4:1
 * ocupa 45pt numa caixa de 90. A versão anterior devolvia a altura da caixa
 * fixa, e o vão de ar entre a marca e o título variava com a imagem.
 */
export function logoDrawnHeight(width: number, height: number): number {
  const scale = Math.min(LOGO_BOX.width / width, LOGO_BOX.height / height);
  return height * scale;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** A cor, se for um hexadecimal de 6 dígitos; senão o padrão. */
export function hexOrFallback(value: string | undefined, fallback: string): string {
  const color = (value ?? '').trim();
  return HEX_COLOR.test(color) ? color : fallback;
}

/**
 * Clareia uma cor misturando-a com branco. `amount` é quanto de branco entra:
 * 0 devolve a cor original, 1 devolve branco.
 *
 * Mistura em sRGB mesmo, sem passar por espaço linear. Para o degrau bem claro
 * que a tarja usa (0,92) a diferença entre os dois é invisível no papel, e a
 * conversão custaria uma dependência ou trinta linhas de matemática de cor.
 */
export function lighten(hex: string, amount: number): string {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(value + (255 - value) * amount);
  };
  const toHex = (value: number) => value.toString(16).padStart(2, '0');
  return `#${toHex(channel(1))}${toHex(channel(3))}${toHex(channel(5))}`;
}

function formatCurrency(value: string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}
