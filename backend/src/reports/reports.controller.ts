import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ActivityReportQueryDto, ServicesReportQueryDto } from './dto/report.dto';
import { ReportPdfService } from './report-pdf.service';
import { ReportsService } from './reports.service';

/**
 * Relatórios.
 *
 * Qualquer autenticado gera; cliente recebe somente os próprios dados, com o
 * filtro aplicado no `WHERE`. O PDF é gerado no servidor, como no legado.
 */
@ApiTags('reports')
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly pdfService: ReportPdfService,
  ) {}

  @Get('activities')
  @ApiOperation({
    summary: 'Relatório de atividades por intervalo (JSON)',
    description:
      'Atividades agrupadas por chamado, com recorte proporcional pelo período ' +
      'e totais por técnico. A data final é inclusiva.',
  })
  @ApiOkResponse({ description: 'Relatório em JSON.' })
  getActivityReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ActivityReportQueryDto,
  ) {
    return this.reportsService.buildActivityReport(user, query.start, query.end);
  }

  @Get('activities.pdf')
  @ApiOperation({ summary: 'Relatório de atividades por intervalo (PDF)' })
  @ApiProduces('application/pdf')
  @Header('Content-Type', 'application/pdf')
  async getActivityReportPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ActivityReportQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const report = await this.reportsService.buildActivityReport(
      user,
      query.start,
      query.end,
    );
    const pdf = await this.pdfService.renderActivityReport(report);

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="relatorio-atividades-${sanitize(report.periodStartLabel)}-a-${sanitize(report.periodEndLabel)}.pdf"`,
    );
    response.setHeader('Content-Length', pdf.length);
    response.end(pdf);
  }

  @Get('services')
  @ApiOperation({
    summary: 'Demonstrativo mensal de serviços (JSON)',
    description: 'Uma linha por atividade do mês, ordenada pelo fim decrescente.',
  })
  @ApiOkResponse({ description: 'Demonstrativo em JSON.' })
  getServicesReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ServicesReportQueryDto,
  ) {
    return this.reportsService.buildServicesReport(user, query.year, query.month);
  }

  @Get('services.pdf')
  @ApiOperation({ summary: 'Demonstrativo mensal de serviços (PDF)' })
  @ApiProduces('application/pdf')
  @Header('Content-Type', 'application/pdf')
  async getServicesReportPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ServicesReportQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const report = await this.reportsService.buildServicesReport(
      user,
      query.year,
      query.month,
    );
    const pdf = await this.pdfService.renderServicesReport(report);

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="demonstrativo-servicos-${report.year}-${String(report.month).padStart(2, '0')}.pdf"`,
    );
    response.setHeader('Content-Length', pdf.length);
    response.end(pdf);
  }
}

/** Deixa o nome do arquivo seguro para o header Content-Disposition. */
function sanitize(value: string): string {
  return value.replace(/[^0-9A-Za-z-]/g, '-');
}
