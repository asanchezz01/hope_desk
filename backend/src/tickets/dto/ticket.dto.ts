import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TICKET_STATUSES, TicketStatus } from '../../common/domain/legacy-enums';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Filtros de status da listagem, exatamente os do dashboard do legado:
 * `nao_concluidos` (default), `all`, ou um dos quatro status.
 */
export const TICKET_STATUS_FILTERS = [
  'nao_concluidos',
  'all',
  ...TICKET_STATUSES,
] as const;
export type TicketStatusFilter = (typeof TICKET_STATUS_FILTERS)[number];

export class CreateTicketDto {
  @ApiProperty({ maxLength: 200 })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Título e descrição são obrigatórios.' })
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Título e descrição são obrigatórios.' })
  @MaxLength(20000)
  description!: string;

  @ApiProperty({
    description: 'Módulo do sistema. Obrigatório e precisa estar ATIVO.',
  })
  @Type(() => Number)
  @IsInt({ message: 'Módulo inválido.' })
  @Min(1, { message: 'Módulo inválido.' })
  systemModuleId!: number;

  @ApiPropertyOptional({
    description:
      'Cliente do chamado. Obrigatório para técnico/superuser; ignorado quando ' +
      'quem abre é o próprio cliente.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Cliente inválido.' })
  @Min(1, { message: 'Cliente inválido.' })
  clientId?: number;

  @ApiPropertyOptional({ description: 'Técnico designado. Opcional.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Técnico inválido.' })
  @Min(1, { message: 'Técnico inválido.' })
  technicianId?: number;
}

export class UpdateTicketDto {
  @ApiProperty({ maxLength: 200 })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Título e descrição são obrigatórios.' })
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Título e descrição são obrigatórios.' })
  @MaxLength(20000)
  description!: string;

  @ApiProperty({ enum: TICKET_STATUSES })
  @IsIn(TICKET_STATUSES, { message: 'Status inválido.' })
  status!: TicketStatus;

  @ApiProperty({ description: 'Cliente do chamado. Obrigatório na edição.' })
  @Type(() => Number)
  @IsInt({ message: 'Cliente inválido.' })
  @Min(1, { message: 'Cliente inválido.' })
  clientId!: number;

  @ApiProperty({
    description:
      'Módulo do sistema. Obrigatório, mas na edição **pode estar inativo** — ' +
      'o legado não filtra por is_active aqui.',
  })
  @Type(() => Number)
  @IsInt({ message: 'Módulo inválido.' })
  @Min(1, { message: 'Módulo inválido.' })
  systemModuleId!: number;

  @ApiPropertyOptional({
    description: 'Técnico designado. Envie null para desatribuir.',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? null : Number(value)))
  @IsInt({ message: 'Técnico inválido.' })
  @Min(1, { message: 'Técnico inválido.' })
  technicianId?: number | null;
}

export class ChangeTicketStatusDto {
  @ApiProperty({ enum: TICKET_STATUSES })
  @IsIn(TICKET_STATUSES, { message: 'Status inválido.' })
  status!: TicketStatus;
}

export class ListTicketsQueryDto {
  @ApiPropertyOptional({
    description: 'Ano de criação. Default: ano corrente (hora de São Paulo).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1970)
  year?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 12,
    description: 'Mês de criação. Default: mês corrente (hora de São Paulo).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  month?: number;

  @ApiPropertyOptional({
    enum: TICKET_STATUS_FILTERS,
    default: 'nao_concluidos',
    description:
      '`nao_concluidos` exclui resolvido e fechado; `all` não filtra. ' +
      'Valor desconhecido cai para `nao_concluidos`, como no legado.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Ignora o filtro de período e busca em todo o histórico.',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  allPeriods?: boolean;

  @ApiPropertyOptional({ description: 'Busca por ID exato ou por título.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

class TicketPartyResponse {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
}

class TicketModuleResponse {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
}

export class TicketResponse {
  @ApiProperty() id!: number;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: TICKET_STATUSES }) status!: string;
  @ApiProperty({ description: 'Rótulo de apresentação (resolvido = Concluído).' })
  statusLabel!: string;
  @ApiProperty({ description: 'Instante UTC de criação, ISO 8601.' })
  createdAt!: string;
  @ApiProperty({ type: TicketPartyResponse }) client!: TicketPartyResponse;
  @ApiPropertyOptional({ type: TicketPartyResponse, nullable: true })
  technician!: TicketPartyResponse | null;
  @ApiPropertyOptional({ type: TicketModuleResponse, nullable: true })
  systemModule!: TicketModuleResponse | null;
  @ApiProperty({ description: 'Quantidade de atividades registradas.' })
  activityCount!: number;
}

export class PaginatedTicketsResponse {
  @ApiProperty({ type: [TicketResponse] }) items!: TicketResponse[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() totalPages!: number;
  @ApiProperty({ description: 'Filtros efetivamente aplicados.' })
  appliedFilters!: {
    year: number | null;
    month: number | null;
    status: string;
    search: string | null;
  };
}
