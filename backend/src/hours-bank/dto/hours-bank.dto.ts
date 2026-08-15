import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class HoursBankQueryDto {
  @ApiPropertyOptional({
    description:
      'Referência do cálculo (ISO local, sem fuso). Default: agora em ' +
      'America/Sao_Paulo. Usado para reproduzir cenários históricos.',
    example: '2026-07-15T12:00:00',
  })
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional({ description: 'Ano do recorte mensal. Default: ano corrente.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1970)
  year?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}

class MonthlyBreakdownResponse {
  @ApiProperty() year!: number;
  @ApiProperty() month!: number;
  @ApiProperty({ description: 'Horas consumidas no mês, dentro do ciclo.' })
  consumedHours!: number;
  @ApiProperty({ description: 'max(consumido − franquia, 0).' })
  excessHours!: number;
}

export class HoursBankResponse {
  @ApiProperty({
    description: 'Saldo líquido do ciclo: excesso − horas pagas. Nunca negativo.',
  })
  netAccumulatedHours!: number;

  @ApiProperty({ description: 'Excesso somado antes do desconto das horas pagas.' })
  grossExcessHours!: number;

  @ApiProperty({ description: 'Horas pagas dentro do ciclo (limites inclusivos).' })
  paidHoursInCycle!: number;

  @ApiProperty({ description: 'Franquia mensal efetiva.' })
  franchiseHours!: number;

  @ApiProperty({ description: 'Total consumido no ciclo, até a referência.' })
  totalConsumedHours!: number;

  @ApiProperty({ description: 'Início do ciclo, ISO local.' })
  cycleStart!: string;

  @ApiProperty({ description: 'Fim do ciclo (exclusivo), ISO local.' })
  cycleEnd!: string;

  @ApiProperty({ description: 'dd/mm/aaaa, como os rótulos do legado.' })
  cycleStartLabel!: string;

  @ApiProperty({ description: 'dd/mm/aaaa.' })
  cycleEndLabel!: string;

  @ApiProperty({ type: [MonthlyBreakdownResponse] })
  monthlyBreakdown!: MonthlyBreakdownResponse[];

  @ApiProperty({ description: 'Referência efetivamente usada, ISO local.' })
  reference!: string;
}

export class MonthlyHoursSummaryResponse {
  @ApiProperty() year!: number;
  @ApiProperty() month!: number;

  @ApiProperty({ description: 'Horas de atividades recortadas no mês.' })
  periodActivityHours!: number;

  @ApiProperty({
    description:
      'Horas de atividades do mês ligadas a chamados criados em OUTROS meses.',
  })
  externalTicketActivityHours!: number;

  @ApiProperty({
    description: 'Horas pagas no mês (limite superior exclusivo, como no legado).',
  })
  paidHoursInMonth!: number;
}
