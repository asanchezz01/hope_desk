import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequiresSuperuser } from '../common/decorators/superuser.decorator';
import {
  CreateSystemModuleDto,
  ListSystemModulesQueryDto,
  PaginatedSystemModulesResponse,
  SystemModuleResponse,
  UpdateSystemModuleDto,
} from './dto/system-module.dto';
import { SystemModulesService } from './system-modules.service';

/**
 * Módulos do sistema.
 *
 * Administração é **superuser-only**, como `manage_system_modules` do legado.
 * A exceção é `GET /system-modules/active`, que qualquer usuário autenticado
 * consulta para abrir chamado.
 */
@ApiTags('system-modules')
@ApiBearerAuth('access-token')
@Controller('system-modules')
export class SystemModulesController {
  constructor(private readonly systemModulesService: SystemModulesService) {}

  @Get('active')
  @ApiOperation({
    summary: 'Lista módulos ativos (qualquer usuário autenticado)',
    description: 'Usado na abertura de chamado, que exige módulo ativo.',
  })
  @ApiOkResponse({ type: [SystemModuleResponse] })
  listActive(): Promise<SystemModuleResponse[]> {
    return this.systemModulesService.listActive();
  }

  @Get()
  @RequiresSuperuser()
  @ApiOperation({ summary: 'Lista módulos (paginado, superuser)' })
  @ApiOkResponse({ type: PaginatedSystemModulesResponse })
  list(
    @Query() query: ListSystemModulesQueryDto,
  ): Promise<PaginatedSystemModulesResponse> {
    return this.systemModulesService.list(query);
  }

  @Get(':id')
  @RequiresSuperuser()
  @ApiOperation({ summary: 'Detalha um módulo (superuser)' })
  @ApiOkResponse({ type: SystemModuleResponse })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<SystemModuleResponse> {
    return this.systemModulesService.findOne(id);
  }

  @Post()
  @RequiresSuperuser()
  @ApiOperation({
    summary: 'Cadastra um módulo (superuser)',
    description: 'Nome é único sem diferenciar maiúsculas, como no legado.',
  })
  @ApiOkResponse({ type: SystemModuleResponse })
  create(@Body() dto: CreateSystemModuleDto): Promise<SystemModuleResponse> {
    return this.systemModulesService.create(dto);
  }

  @Patch(':id')
  @RequiresSuperuser()
  @ApiOperation({ summary: 'Atualiza nome ou situação de um módulo (superuser)' })
  @ApiOkResponse({ type: SystemModuleResponse })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSystemModuleDto,
  ): Promise<SystemModuleResponse> {
    return this.systemModulesService.update(id, dto);
  }

  @Post(':id/toggle')
  @RequiresSuperuser()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ativa ou desativa um módulo (superuser)' })
  @ApiOkResponse({ type: SystemModuleResponse })
  toggle(@Param('id', ParseIntPipe) id: number): Promise<SystemModuleResponse> {
    return this.systemModulesService.toggle(id);
  }

  @Delete(':id')
  @RequiresSuperuser()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Exclui um módulo sem chamados vinculados (superuser)',
    description: 'Com chamados vinculados, desative em vez de excluir.',
  })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.systemModulesService.remove(id);
  }
}
