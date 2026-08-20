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
    description: 'Caminho relativo da logo para o modo escuro. Pode ser vazio.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  companyLogoDark?: string;

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
  @ApiProperty() companyLogoDark!: string;
}

/** Conjunto completo, restrito a superuser. */
export class CompanyParametersResponse extends PublicCompanyParametersResponse {
  @ApiProperty({ description: 'Sempre com 2 casas, como o legado grava.' })
  monthlyHoursAllowance!: string;

  @ApiProperty({ description: 'AAAA-MM-DD.' })
  hoursBankClosingDate!: string;
}

/**
 * Upload da logo em base64 (o stack atual não usa multipart; o JSON carrega a
 * imagem codificada, o que dispensa multer e pref-light de CORS).
 */
export class UploadLogoDto {
  @ApiPropertyOptional({ example: 'logo.png' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  fileName?: string;

  @ApiProperty({ example: 'image/png' })
  @Transform(trim)
  @IsString({ message: 'Informe o contentType da imagem.' })
  @Matches(/^image\/(png|jpeg|webp|gif|svg\+xml)$/, {
    message:
      'Tipo de imagem não suportado para a logo (use PNG, JPEG, WebP, GIF ou SVG).',
  })
  contentType!: string;

  @ApiProperty({
    description:
      'Conteúdo base64 da imagem (aceita também o prefixo data:...;base64,). Máx. 1MB.',
  })
  @IsString({ message: 'Envie a imagem da logo em base64 (dataBase64).' })
  dataBase64!: string;
}

/** Resultado do upload da logo. */
export class UploadCompanyLogoResponse {
  @ApiProperty({ example: 'logo.png' })
  companyLogo!: string;

  @ApiProperty({ example: 4096, description: 'Tamanho em bytes gravado.' })
  size!: number;

  @ApiProperty({ example: 'image/png' })
  contentType!: string;
}

/** Resultado da remoção da logo (volta a marca padrão). */
export class RemoveCompanyLogoResponse {
  @ApiProperty({ example: '', description: 'Parâmetro company_logo limpo.' })
  companyLogo!: string;
}

/** Resultado do upload da logo otimizada para o tema escuro. */
export class UploadCompanyLogoDarkResponse {
  @ApiProperty({ example: 'logo-dark.png' })
  companyLogoDark!: string;

  @ApiProperty({ example: 4096, description: 'Tamanho em bytes gravado.' })
  size!: number;

  @ApiProperty({ example: 'image/png' })
  contentType!: string;
}

/** Resultado da remoção da logo do tema escuro. */
export class RemoveCompanyLogoDarkResponse {
  @ApiProperty({ example: '', description: 'Parâmetro company_logo_dark limpo.' })
  companyLogoDark!: string;
}
