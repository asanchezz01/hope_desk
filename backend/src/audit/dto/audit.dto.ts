import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';

import { AUDIT_ACTIONS, AuditAction } from '../audit.types';

const AUDIT_ACTION_VALUES = Object.values(AUDIT_ACTIONS);

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListAuditQueryDto {
  @ApiPropertyOptional({
    description: 'Ação exata, no formato dominio.verbo.',
    enum: AUDIT_ACTION_VALUES,
  })
  @IsOptional()
  @Transform(trim)
  // Lista fechada: um filtro por ação inexistente devolveria uma trilha vazia
  // e seria lido como "nada aconteceu", que é a conclusão errada mais cara que
  // esta consulta pode produzir.
  @IsIn(AUDIT_ACTION_VALUES, { message: 'Ação de auditoria desconhecida.' })
  action?: AuditAction;

  @ApiPropertyOptional({ description: 'Filtra pelo autor do ato.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  actorId?: number;

  @ApiPropertyOptional({ description: 'Domínio afetado: user, ticket, payment…' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ description: 'Identificador do registro afetado.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  entityId?: number;

  @ApiPropertyOptional({
    description: 'Início do período (instante UTC em ISO 8601, inclusivo).',
    example: '2026-08-01T00:00:00.000Z',
  })
  @IsOptional()
  @Transform(trim)
  @IsISO8601({}, { message: 'Informe uma data inicial válida em ISO 8601.' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Fim do período (instante UTC em ISO 8601, exclusivo).',
    example: '2026-09-01T00:00:00.000Z',
  })
  @IsOptional()
  @Transform(trim)
  @IsISO8601({}, { message: 'Informe uma data final válida em ISO 8601.' })
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

export class AuditActorResponse {
  @ApiProperty({ description: 'Nulo quando o usuário foi excluído depois do ato.' })
  id!: number | null;

  @ApiProperty({
    description: 'Cópia histórica do e-mail, gravada no momento do fato.',
  })
  email!: string | null;

  @ApiProperty({ description: 'Nome atual, quando o usuário ainda existe.' })
  name!: string | null;
}

export class AuditEntryResponse {
  @ApiProperty() id!: number;
  @ApiProperty({ description: 'Ação em dominio.verbo.' }) action!: string;
  @ApiProperty({ type: AuditActorResponse }) actor!: AuditActorResponse;
  @ApiProperty() entityType!: string | null;
  @ApiProperty() entityId!: number | null;
  @ApiProperty({ description: 'Correlaciona com o log da requisição.' })
  correlationId!: string | null;
  @ApiProperty() ipAddress!: string | null;
  @ApiProperty({ description: 'Detalhes não sensíveis, já higienizados na gravação.' })
  metadata!: Record<string, unknown> | null;
  @ApiProperty({ description: 'Instante UTC em ISO 8601.' }) createdAt!: string;
}

export class PaginatedAuditResponse {
  @ApiProperty({ type: [AuditEntryResponse] }) items!: AuditEntryResponse[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() totalPages!: number;
}
