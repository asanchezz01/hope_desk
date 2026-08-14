import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  HoursBankQueryDto,
  HoursBankResponse,
  MonthlyHoursSummaryResponse,
} from './dto/hours-bank.dto';
import { HoursBankService } from './hours-bank.service';

/**
 * Banco de horas.
 *
 * Qualquer usuário autenticado consulta; o **escopo** é que muda: cliente vê
 * somente atividades dos próprios chamados, técnico e superuser veem tudo.
 * O filtro é aplicado no `WHERE`, não na apresentação.
 */
@ApiTags('hours-bank')
@ApiBearerAuth('access-token')
@Controller('hours-bank')
export class HoursBankController {
  constructor(private readonly hoursBankService: HoursBankService) {}

  @Get()
  @ApiOperation({
    summary: 'Saldo do banco de horas no ciclo corrente',
    description:
      'Ciclo semestral a partir de `hours_bank_closing_date`. O excesso é ' +
      'calculado mês a mês (sem compensar entre meses), as horas pagas do ciclo ' +
      'são descontadas e o saldo nunca fica negativo.',
  })
  @ApiOkResponse({ type: HoursBankResponse })
  getHoursBank(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: HoursBankQueryDto,
  ): Promise<HoursBankResponse> {
    return this.hoursBankService.getHoursBank(user, query);
  }

  @Get('monthly-summary')
  @ApiOperation({
    summary: 'Resumo de horas de um mês',
    description:
      'Inclui as horas de atividades do mês ligadas a chamados criados em ' +
      'outros meses, e as horas pagas no mês.',
  })
  @ApiOkResponse({ type: MonthlyHoursSummaryResponse })
  getMonthlySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: HoursBankQueryDto,
  ): Promise<MonthlyHoursSummaryResponse> {
    return this.hoursBankService.getMonthlySummary(user, query);
  }
}
