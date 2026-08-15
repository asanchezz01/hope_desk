import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateCompanyParametersDto {
  @ApiPropertyOptional({ example: 'Hope Desk' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Informe o nome da empresa.' })
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional({ example: 'Rua Exemplo, 100 — São Paulo/SP' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Informe o endereço da empresa.' })
  @MaxLength(500)
  companyAddress?: string;

  @ApiPropertyOptional({
    description: 'URL http(s) ou caminho relativo do arquivo. Pode ser vazio.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  companyLogo?: string;

  @ApiPropertyOptional({
    description: 'Franquia mensal de horas. Aceita vírgula decimal.',
    example: '16',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  monthlyHoursAllowance?: string;

  @ApiPropertyOptional({
    description: 'Data de fechamento do banco de horas, em AAAA-MM-DD.',
    example: '2026-01-01',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Informe a data de fechamento no formato AAAA-MM-DD.',
  })
  hoursBankClosingDate?: string;
}

/** Parâmetros de apresentação, legíveis por qualquer usuário autenticado. */
export class PublicCompanyParametersResponse {
  @ApiProperty() companyName!: string;
  @ApiProperty() companyAddress!: string;
  @ApiProperty() companyLogo!: string;
}

/** Conjunto completo, restrito a superuser. */
export class CompanyParametersResponse extends PublicCompanyParametersResponse {
  @ApiProperty({ description: 'Sempre com 2 casas, como o legado grava.' })
  monthlyHoursAllowance!: string;

  @ApiProperty({ description: 'AAAA-MM-DD.' })
  hoursBankClosingDate!: string;
}
