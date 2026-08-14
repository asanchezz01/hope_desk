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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  ChangeTicketStatusDto,
  CreateTicketDto,
  ListTicketsQueryDto,
  PaginatedTicketsResponse,
  TicketResponse,
  UpdateTicketDto,
} from './dto/ticket.dto';
import { TicketsService } from './tickets.service';

/**
 * Chamados.
 *
 * Sem `@Roles` no controller: **cliente também usa** estas rotas. O legado só
 * exige `@login_required` em `new_ticket` e `ticket_detail`. A autorização fina
 * (isolamento por cliente, quem edita, quem exclui) fica em `ticket.policy.ts` e
 * é aplicada no service — nunca só escondendo botão no frontend.
 */
@ApiTags('tickets')
@ApiBearerAuth('access-token')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista chamados (paginado)',
    description:
      'Cliente vê apenas os próprios chamados. Filtros de período (ano/mês de ' +
      'criação) e status seguem o dashboard do legado, com `nao_concluidos` ' +
      'como default.',
  })
  @ApiOkResponse({ type: PaginatedTicketsResponse })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTicketsQueryDto,
  ): Promise<PaginatedTicketsResponse> {
    return this.ticketsService.list(user, query);
  }

  @Get('available-years')
  @ApiOperation({
    summary: 'Anos com chamados no escopo do usuário',
    description: 'Inclui sempre o ano corrente, como o seletor do legado.',
  })
  @ApiOkResponse({ type: [Number] })
  availableYears(@CurrentUser() user: AuthenticatedUser): Promise<number[]> {
    return this.ticketsService.availableYears(user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalha um chamado',
    description:
      'Cliente que tenta acessar chamado de outro recebe 404, não 403 — a API ' +
      'não revela a existência de chamados alheios.',
  })
  @ApiOkResponse({ type: TicketResponse })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TicketResponse> {
    return this.ticketsService.findOne(user, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Abre um chamado',
    description:
      'Cliente abre para si (qualquer `clientId` enviado é ignorado). ' +
      'Técnico e superuser precisam informar o cliente. O módulo é obrigatório ' +
      'e precisa estar ATIVO.',
  })
  @ApiOkResponse({ type: TicketResponse })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTicketDto,
  ): Promise<TicketResponse> {
    return this.ticketsService.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edita um chamado (técnico ou superuser)',
    description:
      'Diferente da criação, o módulo informado **pode estar inativo** — é o ' +
      'comportamento do legado, para não travar chamados antigos.',
  })
  @ApiOkResponse({ type: TicketResponse })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketDto,
  ): Promise<TicketResponse> {
    return this.ticketsService.update(user, id, dto);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Altera o status de um chamado (técnico ou superuser)' })
  @ApiOkResponse({ type: TicketResponse })
  changeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeTicketStatusDto,
  ): Promise<TicketResponse> {
    return this.ticketsService.changeStatus(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Exclui um chamado',
    description:
      'Técnico exclui apenas chamados do mês corrente; meses anteriores ' +
      'somente superuser. As atividades caem em cascata.',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.ticketsService.remove(user, id);
  }
}
