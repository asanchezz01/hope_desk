import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RequiresSuperuser } from '../common/decorators/superuser.decorator';
import {
  CompanyParametersResponse,
  PublicCompanyParametersResponse,
  RemoveCompanyLogoResponse,
  UpdateCompanyParametersDto,
  UploadCompanyLogoResponse,
  UploadLogoDto,
} from './dto/parameter.dto';
import { ParametersService } from './parameters.service';

/**
 * Parâmetros da empresa.
 *
 * Edição é superuser-only, como `manage_company_parameters` do legado.
 * A leitura dos campos de apresentação é liberada a qualquer usuário
 * autenticado, porque o legado os usa no cabeçalho de todo PDF gerado por
 * qualquer perfil (ver docs/LEGACY_CONTRACTS.md §8 nota ²).
 */
@ApiTags('parameters')
@ApiBearerAuth('access-token')
@Controller('parameters')
export class ParametersController {
  constructor(private readonly parametersService: ParametersService) {}

  @Get('public')
  @ApiOperation({
    summary: 'Nome, endereço e logo da empresa (qualquer usuário autenticado)',
  })
  @ApiOkResponse({ type: PublicCompanyParametersResponse })
  findPublic(): Promise<PublicCompanyParametersResponse> {
    return this.parametersService.findPublic();
  }

  @Get()
  @RequiresSuperuser()
  @ApiOperation({ summary: 'Todos os parâmetros da empresa (superuser)' })
  @ApiOkResponse({ type: CompanyParametersResponse })
  findAll(): Promise<CompanyParametersResponse> {
    return this.parametersService.findAll();
  }

  @Patch()
  @RequiresSuperuser()
  @ApiOperation({
    summary: 'Atualiza os parâmetros da empresa (superuser)',
    description:
      'A franquia mensal aceita vírgula decimal e é gravada com 2 casas. ' +
      'A data de fechamento usa AAAA-MM-DD.',
  })
  @ApiOkResponse({ type: CompanyParametersResponse })
  update(@Body() dto: UpdateCompanyParametersDto): Promise<CompanyParametersResponse> {
    return this.parametersService.update(dto);
  }

  /**
   * Serve a logo da empresa (imagem).
   *
   * `@Public()` de propósito: as telas de autenticação (login/esqueci a senha)
   * exibem a logo ANTES de haver token. Somente lê o arquivo gravado dentro
   * da pasta de logos — nunca um caminho arbitrário
   * (ver `ParametersService.resolveLogoPath`).
   */
  @Get('logo')
  @Public()
  @ApiOperation({ summary: 'Imagem da logo da empresa (público, sem token)' })
  @ApiProduces('image/*')
  async getLogo(@Res() response: Response): Promise<void> {
    const logo = await this.parametersService.getLogoFile();
    if (!logo) {
      response.status(404).json({ statusCode: 404, message: 'Logo não configurada.' });
      return;
    }
    response.setHeader('Content-Type', logo.contentType);
    response.setHeader('Content-Length', logo.size);
    response.setHeader('Cache-Control', 'no-store');
    response.end(logo.buffer);
  }

  @Post('logo')
  // `@Post` devolve 201 por padrão; o contrato (e o `@ApiOkResponse` abaixo)
  // declara 200, alinhado ao resto deste controlador.
  @HttpCode(200)
  @RequiresSuperuser()
  @ApiOperation({
    summary: 'Envia a logo da empresa (base64, superuser)',
    description: 'Aceita PNG, JPEG, WebP, GIF ou SVG de até 1MB em base64.',
  })
  @ApiOkResponse({ type: UploadCompanyLogoResponse })
  uploadLogo(@Body() dto: UploadLogoDto): Promise<UploadCompanyLogoResponse> {
    return this.parametersService.uploadLogo(dto);
  }

  @Delete('logo')
  @RequiresSuperuser()
  @ApiOperation({
    summary: 'Remove a logo da empresa (superuser)',
    description: 'Limpa o parâmetro e volta a marca padrão.',
  })
  @ApiOkResponse({ type: RemoveCompanyLogoResponse })
  removeLogo(): Promise<RemoveCompanyLogoResponse> {
    return this.parametersService.deleteLogo();
  }
}
