import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Três visões, como no legado:
 *   - ano + mês  → visão mensal, eixo por dia;
 *   - só ano     → visão anual, eixo por mês;
 *   - nenhum dos dois, com `allPeriods=true` → todo o período.
 *
 * Sem nenhum parâmetro, o default é o mês corrente.
 */
export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Ano. Omitido com allPeriods=true = todo o período.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1970)
  year?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 12,
    description: 'Mês. Omitido = visão anual.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ description: 'Ignora ano e mês e usa todo o histórico.' })
  @IsOptional()
  @Type(() => Boolean)
  allPeriods?: boolean;
}

class BucketDto {
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
}

class CountByKeyDto {
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
  @ApiProperty() count!: number;
  @ApiProperty() hours!: number;
}

class KpisDto {
  @ApiProperty() totalTickets!: number;
  @ApiProperty() concludedTickets!: number;
  @ApiProperty() openTickets!: number;
  @ApiProperty() totalHours!: number;
  @ApiProperty() averageHoursPerTicket!: number;
  @ApiProperty({ nullable: true }) averageFirstResponseHours!: number | null;
  @ApiProperty() ticketsWithActivity!: number;
}

class BacklogDto {
  @ApiProperty({
    description: 'Aberto ou em andamento, em todo o histórico do escopo.',
  })
  total!: number;
  @ApiProperty() oldestDays!: number;
  @ApiProperty({ nullable: true }) oldestTicketId!: number | null;
}

class TrendPointDto {
  @ApiProperty() label!: string;
  @ApiProperty() year!: number;
  @ApiProperty() month!: number;
  @ApiProperty() tickets!: number;
  @ApiProperty() hours!: number;
}

export class AnalyticsResponse {
  @ApiProperty({ description: 'Rótulo da visão, como no legado.' })
  periodLabel!: string;

  @ApiProperty({ enum: ['day', 'month'] })
  bucketMode!: string;

  @ApiProperty({ type: [BucketDto], description: 'Eixo do gráfico de atividade.' })
  buckets!: BucketDto[];

  @ApiProperty({ nullable: true }) selectedYear!: number | null;
  @ApiProperty({ nullable: true }) selectedMonth!: number | null;

  @ApiProperty({
    type: [Number],
    description: 'Anos com chamados, mais o ano corrente.',
  })
  availableYears!: number[];

  @ApiProperty({ type: KpisDto }) kpis!: KpisDto;
  @ApiProperty({ type: BacklogDto }) backlog!: BacklogDto;

  @ApiProperty({ type: [CountByKeyDto] }) byStatus!: CountByKeyDto[];
  @ApiProperty({ type: [CountByKeyDto] }) byModule!: CountByKeyDto[];
  @ApiProperty({ type: [CountByKeyDto] }) byTechnician!: CountByKeyDto[];
  @ApiProperty({ type: [CountByKeyDto] }) byClient!: CountByKeyDto[];

  @ApiProperty({
    type: [TrendPointDto],
    description: '12 meses encerrando no período.',
  })
  trend!: TrendPointDto[];

  @ApiProperty({
    description: 'Linhas de chamado, para filtros cruzados no frontend.',
    isArray: true,
    type: Object,
  })
  tickets!: unknown[];

  @ApiProperty({
    description: 'Linhas de atividade recortadas no período, para filtros cruzados.',
    isArray: true,
    type: Object,
  })
  activities!: unknown[];

  @ApiProperty({ description: 'Horas por bucket do eixo.', type: Object })
  hoursByBucket!: Record<string, number>;

  @ApiProperty({ description: 'Chamados abertos por bucket do eixo.', type: Object })
  ticketsByBucket!: Record<string, number>;

  @ApiProperty({ description: 'Saldo do banco de horas no ciclo corrente.' })
  accumulatedHours!: number;

  @ApiProperty() monthlyHoursAllowance!: number;

  @ApiProperty({ description: 'Horas pagas no período selecionado.' })
  paidHoursInPeriod!: number;

  @ApiProperty() cycleStartLabel!: string;
  @ApiProperty() cycleEndLabel!: string;

  @ApiProperty({ description: 'Rótulos e cores de status do legado.', type: Object })
  statusMeta!: Record<string, { label: string; color: string }>;
}
