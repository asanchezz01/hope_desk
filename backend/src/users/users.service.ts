import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PasswordService } from '../auth/password/password.service';
import { TokenService } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUserDto,
  ListUsersQueryDto,
  PaginatedUsersResponse,
  UpdateUserDto,
  UserResponse,
} from './dto/user.dto';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/** Projeção segura: hash de senha e token de recuperação nunca saem daqui. */
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isSuperuser: true,
  mustChangePassword: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<PaginatedUsersResponse> {
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const where: Prisma.UserWhereInput = {};
    if (query.role) {
      where.role = query.role;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    };
  }

  async findOne(id: number): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return user;
  }

  async create(actor: AuthenticatedUser, dto: CreateUserDto): Promise<UserResponse> {
    // Só superuser concede superuser — evita escalada de privilégio.
    if (dto.isSuperuser && !actor.isSuperuser) {
      throw new ForbiddenException(
        'Somente um superuser pode conceder privilégio de superuser.',
      );
    }

    await this.assertEmailAvailable(dto.email);

    const passwordHash = await this.passwordService.hash(dto.password);

    try {
      return await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: dto.role,
          isSuperuser: dto.isSuperuser ?? false,
          mustChangePassword: dto.mustChangePassword ?? false,
        },
        select: USER_SELECT,
      });
    } catch (error) {
      throw this.translateUniqueViolation(error);
    }
  }

  async update(
    actor: AuthenticatedUser,
    id: number,
    dto: UpdateUserDto,
  ): Promise<UserResponse> {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (dto.isSuperuser !== undefined && !actor.isSuperuser) {
      throw new ForbiddenException(
        'Somente um superuser pode alterar o privilégio de superuser.',
      );
    }

    // Impede que o último superuser se rebaixe e tranque a administração.
    if (dto.isSuperuser === false && target.isSuperuser) {
      await this.assertNotLastSuperuser(target.id);
    }

    // Rebaixar o próprio papel para client removeria o próprio acesso admin.
    if (dto.role && dto.role !== target.role && target.id === actor.id) {
      throw new BadRequestException('Você não pode alterar o seu próprio perfil.');
    }

    if (dto.email && dto.email !== target.email) {
      await this.assertEmailAvailable(dto.email);
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isSuperuser !== undefined) data.isSuperuser = dto.isSuperuser;
    if (dto.mustChangePassword !== undefined) {
      data.mustChangePassword = dto.mustChangePassword;
    }

    if (dto.password !== undefined) {
      data.passwordHash = await this.passwordService.hash(dto.password);
      // Senha redefinida por administrador: token pendente perde validade.
      data.resetTokenHash = null;
      data.resetTokenExpiresAt = null;
    }

    let updated: UserResponse;
    try {
      updated = await this.prisma.user.update({
        where: { id },
        data,
        select: USER_SELECT,
      });
    } catch (error) {
      throw this.translateUniqueViolation(error);
    }

    // Mudança de senha, papel ou privilégio invalida os tokens já emitidos.
    const invalidatesSessions =
      dto.password !== undefined ||
      dto.role !== undefined ||
      dto.isSuperuser !== undefined ||
      dto.mustChangePassword === true;

    if (invalidatesSessions) {
      await this.tokenService.revokeAllForUser(id);
    }

    return updated;
  }

  /**
   * Exclusão com as mesmas três recusas do `delete_user` do legado:
   * o próprio usuário, usuário com chamados, usuário com atividades.
   */
  async remove(actor: AuthenticatedUser, id: number): Promise<void> {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (target.id === actor.id) {
      throw new BadRequestException('Você não pode excluir o seu próprio usuário.');
    }

    if (target.isSuperuser) {
      await this.assertNotLastSuperuser(target.id);
    }

    const [ticketsAsClient, ticketsAsTechnician, activities] = await Promise.all([
      this.prisma.ticket.count({ where: { clientId: id } }),
      this.prisma.ticket.count({ where: { technicianId: id } }),
      this.prisma.activity.count({ where: { createdById: id } }),
    ]);

    if (ticketsAsClient + ticketsAsTechnician + activities > 0) {
      throw new ConflictException(
        'Não é possível excluir este usuário porque ele possui chamados ou ' +
          'atividades vinculadas.',
      );
    }

    // refresh_token cai por ON DELETE CASCADE.
    await this.prisma.user.delete({ where: { id } });
  }

  /** Lista técnicos para atribuição de chamados (usado pelas Fases 04 e 09). */
  async listTechnicians(): Promise<UserResponse[]> {
    return this.prisma.user.findMany({
      where: { role: 'technician' },
      select: USER_SELECT,
      orderBy: [{ name: 'asc' }],
    });
  }

  /** Lista clientes para criação de chamado por técnico. */
  async listClients(): Promise<UserResponse[]> {
    return this.prisma.user.findMany({
      where: { role: 'client' },
      select: USER_SELECT,
      orderBy: [{ name: 'asc' }],
    });
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }
  }

  private async assertNotLastSuperuser(userId: number): Promise<void> {
    const others = await this.prisma.user.count({
      where: { isSuperuser: true, id: { not: userId } },
    });
    if (others === 0) {
      throw new BadRequestException(
        'Não é possível remover o último superuser do sistema.',
      );
    }
  }

  /** Converte a corrida entre a checagem e o INSERT numa 409 clara. */
  private translateUniqueViolation(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException('Já existe um usuário com este e-mail.');
    }
    return error;
  }
}
