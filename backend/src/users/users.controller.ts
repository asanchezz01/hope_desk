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
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateUserDto,
  ListUsersQueryDto,
  PaginatedUsersResponse,
  UpdateUserDto,
  UserResponse,
} from './dto/user.dto';
import { UsersService } from './users.service';

/**
 * Gestão de usuários. Todo o controller exige papel `technician`, como o
 * `@role_required("technician")` do legado. Superuser passa por herança da regra.
 */
@ApiTags('users')
@ApiBearerAuth('access-token')
@Roles('technician')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuários (paginado)' })
  @ApiOkResponse({ type: PaginatedUsersResponse })
  list(@Query() query: ListUsersQueryDto): Promise<PaginatedUsersResponse> {
    return this.usersService.list(query);
  }

  @Get('technicians')
  @ApiOperation({ summary: 'Lista técnicos, para atribuição de chamados' })
  @ApiOkResponse({ type: [UserResponse] })
  listTechnicians(): Promise<UserResponse[]> {
    return this.usersService.listTechnicians();
  }

  @Get('clients')
  @ApiOperation({ summary: 'Lista clientes, para abertura de chamado por técnico' })
  @ApiOkResponse({ type: [UserResponse] })
  listClients(): Promise<UserResponse[]> {
    return this.usersService.listClients();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um usuário' })
  @ApiOkResponse({ type: UserResponse })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<UserResponse> {
    return this.usersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria um usuário' })
  @ApiOkResponse({ type: UserResponse })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ): Promise<UserResponse> {
    return this.usersService.create(actor, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um usuário' })
  @ApiOkResponse({ type: UserResponse })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponse> {
    return this.usersService.update(actor, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Exclui um usuário',
    description:
      'Recusa o próprio usuário, o último superuser, e usuários com chamados ' +
      'ou atividades vinculadas.',
  })
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.usersService.remove(actor, id);
  }
}
