import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequiresSuperuser } from '../common/decorators/superuser.decorator';
import {
  CreatePaymentDto,
  ListPaymentsQueryDto,
  PaginatedPaymentsResponse,
  PaymentResponse,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';

/**
 * Pagamentos. Superuser-only em todas as operações, como `manage_payments` e
 * `delete_payment` do legado.
 */
@ApiTags('payments')
@ApiBearerAuth('access-token')
@RequiresSuperuser()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista pagamentos (paginado, superuser)',
    description:
      'Aceita recorte por período em paid_at, inclusivo nas duas pontas. ' +
      'Os totais referem-se ao período inteiro, não apenas à página.',
  })
  @ApiOkResponse({ type: PaginatedPaymentsResponse })
  list(@Query() query: ListPaymentsQueryDto): Promise<PaginatedPaymentsResponse> {
    return this.paymentsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um pagamento (superuser)' })
  @ApiOkResponse({ type: PaymentResponse })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<PaymentResponse> {
    return this.paymentsService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Registra um pagamento (superuser)',
    description: 'Valor e horas aceitam vírgula decimal e não podem ser negativos.',
  })
  @ApiOkResponse({ type: PaymentResponse })
  create(@Body() dto: CreatePaymentDto): Promise<PaymentResponse> {
    return this.paymentsService.create(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Exclui um pagamento (superuser)',
    description:
      'Sem janela temporal, como no legado — diferente de chamados e atividades.',
  })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.paymentsService.remove(id);
  }
}
