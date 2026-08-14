import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, AnalyticsResponse } from './dto/analytics.dto';

/**
 * Analytics.
 *
 * Qualquer autenticado consulta; cliente vê somente os próprios dados, com o
 * filtro aplicado no `WHERE` de cada consulta.
 */
@ApiTags('analytics')
@ApiBearerAuth('access-token')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @ApiOperation({
    summary: 'Painel de indicadores',
    description:
      'Três visões, como no legado: ano+mês (eixo diário), só ano (eixo mensal) ' +
      'e todo o período (`allPeriods=true`). Sem parâmetros, devolve o mês ' +
      'corrente. Inclui KPIs, backlog, agregações por status/módulo/técnico/' +
      'cliente, tendência de 12 meses e as linhas cruas para filtros cruzados.',
  })
  @ApiOkResponse({ type: AnalyticsResponse })
  getAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsResponse> {
    return this.analyticsService.getAnalytics(user, query);
  }
}
