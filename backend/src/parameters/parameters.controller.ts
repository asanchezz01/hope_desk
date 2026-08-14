import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequiresSuperuser } from '../common/decorators/superuser.decorator';
import {
  CompanyParametersResponse,
  PublicCompanyParametersResponse,
  UpdateCompanyParametersDto,
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
}
