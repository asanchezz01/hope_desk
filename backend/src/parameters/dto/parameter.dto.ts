import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

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
    description:
      'Texto ao lado da logo no cabeçalho. Vazio deixa só a logo — não cai ' +
      'no default. Sem `MinLength` de propósito.',
    example: 'Hope Desk',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  headerTitle?: string;

  @ApiPropertyOptional({
    description: 'Cor principal da identidade visual em hexadecimal.',
    example: '#0d7f57',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(HEX_COLOR, {
    message: 'Informe uma cor hexadecimal válida no formato #RRGGBB.',
  })
  primaryColor?: string;

  @ApiPropertyOptional({
    description: 'Cor secundária da identidade visual em hexadecimal.',
    example: '#203753',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(HEX_COLOR, {
    message: 'Informe uma cor hexadecimal válida no formato #RRGGBB.',
  })
  secondaryColor?: string;

  @ApiPropertyOptional({
    description: 'Cor de destaque da identidade visual em hexadecimal.',
    example: '#a2600b',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(HEX_COLOR, {
    message: 'Informe uma cor hexadecimal válida no formato #RRGGBB.',
  })
  accentColor?: string;

  @ApiPropertyOptional({
    description: 'Cor de informação da identidade visual em hexadecimal.',
    example: '#1f5fe0',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(HEX_COLOR, {
    message: 'Informe uma cor hexadecimal válida no formato #RRGGBB.',
  })
  infoColor?: string;

  @ApiPropertyOptional({
    description: 'Cor de ações destrutivas em hexadecimal.',
    example: '#b03a3a',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(HEX_COLOR, {
    message: 'Informe uma cor hexadecimal válida no formato #RRGGBB.',
  })
  dangerColor?: string;

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
    description:
      'Valor cobrado por hora no relatório de atividades. Aceita vírgula decimal.',
    example: '150,00',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  activityHourlyRate?: string;

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
  @ApiProperty({ description: 'Texto ao lado da logo. Pode ser vazio.' })
  headerTitle!: string;
}

/**
 * Marca exibida ANTES do login (esqueci a senha, redefinição).
 *
 * Endpoint próprio, e não `GET /parameters/public`, porque este é `@Public()`:
 * carrega só o texto ao lado da logo, sem o nome e o endereço da empresa, que
 * não têm por que sair sem token. Mesma razão de a imagem da logo ser pública.
 */
export class BrandingResponse {
  @ApiProperty({ description: 'Texto ao lado da logo. Pode ser vazio.' })
  headerTitle!: string;
}

/** Conjunto completo, restrito a superuser. */
export class CompanyParametersResponse extends PublicCompanyParametersResponse {
  @ApiProperty({ description: 'Logo exclusiva dos relatórios PDF. Pode ser vazia.' })
  reportLogo!: string;

  @ApiProperty() primaryColor!: string;
  @ApiProperty() secondaryColor!: string;
  @ApiProperty() accentColor!: string;
  @ApiProperty() infoColor!: string;
  @ApiProperty() dangerColor!: string;

  @ApiProperty({ description: 'Sempre com 2 casas, como o legado grava.' })
  monthlyHoursAllowance!: string;

  @ApiProperty({
    description:
      'Valor cobrado por hora no relatório de atividades, sempre com 2 casas.',
  })
  activityHourlyRate!: string;

  @ApiProperty({ description: 'AAAA-MM-DD.' })
  hoursBankClosingDate!: string;
}

/** Cores públicas necessárias para a marca ser aplicada antes do login. */
export class VisualIdentityResponse {
  @ApiProperty() primaryColor!: string;
  @ApiProperty() secondaryColor!: string;
  @ApiProperty() accentColor!: string;
  @ApiProperty() infoColor!: string;
  @ApiProperty() dangerColor!: string;
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

/** Resultado do upload da logo exclusiva dos relatórios PDF. */
export class UploadReportLogoResponse {
  @ApiProperty({ example: 'logo-report.png' })
  reportLogo!: string;

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

/** Resultado da remoção da logo exclusiva dos relatórios PDF. */
export class RemoveReportLogoResponse {
  @ApiProperty({ example: '', description: 'Parâmetro report_logo limpo.' })
  reportLogo!: string;
}
