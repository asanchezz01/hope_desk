import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ActivityReportQueryDto {
  @ApiPropertyOptional({
    description: 'Início do intervalo, AAAA-MM-DD. Default: 1º do mês corrente.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Informe uma data inicial válida (AAAA-MM-DD).',
  })
  start?: string;

  @ApiPropertyOptional({
    description: 'Fim do intervalo, AAAA-MM-DD. INCLUSIVO. Default: hoje.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Informe uma data final válida (AAAA-MM-DD).',
  })
  end?: string;
}

export class ServicesReportQueryDto {
  @ApiPropertyOptional({ description: 'Ano de referência. Default: ano corrente.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1970)
  year?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 12,
    description: 'Default: mês corrente.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}
