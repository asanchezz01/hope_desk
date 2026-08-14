import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { DecimalView } from '../../common/money/decimal.util';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreatePaymentDto {
  @ApiProperty({ description: 'Data do pagamento, AAAA-MM-DD.', example: '2026-07-15' })
  @Transform(trim)
  @IsString()
  @Matches(ISO_DATE, { message: 'Informe uma data de pagamento válida (AAAA-MM-DD).' })
  paidAt!: string;

  @ApiProperty({
    description: 'Valor pago. Aceita vírgula decimal. Não pode ser negativo.',
    example: '1500,00',
  })
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  amount!: string;

  @ApiProperty({
    description: 'Horas pagas. Aceita vírgula decimal. Não pode ser negativo.',
    example: '10,5',
  })
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  paidHours!: string;
}

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({ description: 'Início do período, AAAA-MM-DD (inclusivo).' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(ISO_DATE, { message: 'Informe uma data inicial válida (AAAA-MM-DD).' })
  from?: string;

  @ApiPropertyOptional({ description: 'Fim do período, AAAA-MM-DD (inclusivo).' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(ISO_DATE, { message: 'Informe uma data final válida (AAAA-MM-DD).' })
  to?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

class DecimalViewResponse implements DecimalView {
  @ApiProperty({ description: 'Valor exato, ponto decimal. Use para cálculo.' })
  value!: string;

  @ApiProperty({ description: 'Apresentação pt-BR. Use apenas para exibir.' })
  formatted!: string;
}

export class PaymentResponse {
  @ApiProperty() id!: number;
  @ApiProperty({ description: 'AAAA-MM-DD.' }) paidAt!: string;
  @ApiProperty({ type: DecimalViewResponse }) amount!: DecimalView;
  @ApiProperty({ type: DecimalViewResponse }) paidHours!: DecimalView;
  @ApiProperty({ description: 'Instante UTC em ISO 8601.' }) createdAt!: string;
}

export class PaymentTotalsResponse {
  @ApiProperty({ type: DecimalViewResponse }) amount!: DecimalView;
  @ApiProperty({ type: DecimalViewResponse }) paidHours!: DecimalView;
}

export class PaginatedPaymentsResponse {
  @ApiProperty({ type: [PaymentResponse] }) items!: PaymentResponse[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() totalPages!: number;

  @ApiProperty({
    type: PaymentTotalsResponse,
    description: 'Totais do período filtrado inteiro, não apenas da página.',
  })
  totals!: PaymentTotalsResponse;
}
