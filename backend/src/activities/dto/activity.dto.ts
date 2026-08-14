import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Início e fim são **hora de parede** de America/Sao_Paulo.
 *
 * Aceitos: `2026-03-10T08:30`, `2026-03-10T08:30:00` (tomados como parede) e
 * valores com fuso explícito (convertidos para a parede equivalente).
 * A validação de formato acontece no service, via `parseWallClockInput`, para
 * que a mensagem de erro seja a mesma do legado.
 */
export class CreateActivityDto {
  @ApiProperty({ description: 'Descrição da atividade. Obrigatória.' })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Descreva a atividade.' })
  @MaxLength(20000)
  notes!: string;

  @ApiProperty({ example: '2026-03-10T08:30', description: 'Hora de parede.' })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Datas inválidas. Use data e hora válidas.' })
  startedAt!: string;

  @ApiProperty({ example: '2026-03-10T10:45', description: 'Hora de parede.' })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Datas inválidas. Use data e hora válidas.' })
  endedAt!: string;
}

/** A edição do legado reenvia os três campos. */
export class UpdateActivityDto extends CreateActivityDto {}

class ActivityAuthorResponse {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
}

export class ActivityResponse {
  @ApiProperty() id!: number;
  @ApiProperty() ticketId!: number;
  @ApiProperty() notes!: string;

  @ApiProperty({ description: 'Hora de parede, ISO local sem fuso.' })
  startedAt!: string;

  @ApiProperty({ description: 'Hora de parede, ISO local sem fuso.' })
  endedAt!: string;

  @ApiProperty({ description: 'dd/mm/aaaa HH:MM, como no legado.' })
  startedLabel!: string;

  @ApiProperty({ description: 'dd/mm/aaaa HH:MM.' })
  endedLabel!: string;

  @ApiProperty({ description: 'Duração em horas, 2 casas.' })
  durationHours!: number;

  @ApiProperty({ type: ActivityAuthorResponse })
  createdBy!: ActivityAuthorResponse;

  @ApiPropertyOptional({
    description: 'Se o usuário atual pode editar (somente o autor).',
  })
  canEdit!: boolean;

  @ApiPropertyOptional({ description: 'Se o usuário atual pode excluir.' })
  canDelete!: boolean;
}

export class ActivityListResponse {
  @ApiProperty({ type: [ActivityResponse] }) items!: ActivityResponse[];
  @ApiProperty({ description: 'Soma das durações, 2 casas.' })
  totalHours!: number;
}
