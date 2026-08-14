import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ActivitiesService } from './activities.service';
import {
  ActivityListResponse,
  ActivityResponse,
  CreateActivityDto,
  UpdateActivityDto,
} from './dto/activity.dto';

/**
 * Atividades de um chamado.
 *
 * Rotas aninhadas, como as URLs do legado
 * (`/tickets/<id>/activities/<activity_id>/...`). Uma atividade que não
 * pertence ao chamado informado devolve 404.
 */
@ApiTags('activities')
@ApiBearerAuth('access-token')
@Controller('tickets/:ticketId/activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista as atividades de um chamado',
    description:
      'Cliente só acessa as atividades dos próprios chamados. Ordenadas por ' +
      'início ascendente, com o total de horas.',
  })
  @ApiOkResponse({ type: ActivityListResponse })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId', ParseIntPipe) ticketId: number,
  ): Promise<ActivityListResponse> {
    return this.activitiesService.list(user, ticketId);
  }

  @Post()
  @ApiOperation({
    summary: 'Registra uma atividade (técnico ou superuser)',
    description:
      'Início e fim são hora de parede de America/Sao_Paulo. Fim estritamente ' +
      'posterior ao início, duração máxima de 12 horas, e sem sobreposição com ' +
      'outra atividade do mesmo técnico — em qualquer chamado.',
  })
  @ApiOkResponse({ type: ActivityResponse })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() dto: CreateActivityDto,
  ): Promise<ActivityResponse> {
    return this.activitiesService.create(user, ticketId, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edita uma atividade — SOMENTE o autor',
    description:
      'Nem o superuser edita atividade lançada por outro técnico: é a regra do ' +
      '`edit_activity` do legado, preservada. A própria atividade é excluída da ' +
      'verificação de conflito.',
  })
  @ApiOkResponse({ type: ActivityResponse })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActivityDto,
  ): Promise<ActivityResponse> {
    return this.activitiesService.update(user, ticketId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Exclui uma atividade',
    description:
      'Técnico exclui atividades do mês corrente (mesmo de outro autor); ' +
      'meses anteriores somente superuser.',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.activitiesService.remove(user, ticketId, id);
  }
}
