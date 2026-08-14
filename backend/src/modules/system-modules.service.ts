import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSystemModuleDto,
  ListSystemModulesQueryDto,
  PaginatedSystemModulesResponse,
  SystemModuleResponse,
  UpdateSystemModuleDto,
} from './dto/system-module.dto';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const MODULE_SELECT = {
  id: true,
  name: true,
  isActive: true,
} satisfies Prisma.SystemModuleSelect;

@Injectable()
export class SystemModulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListSystemModulesQueryDto,
  ): Promise<PaginatedSystemModulesResponse> {
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const where: Prisma.SystemModuleWhereInput = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.systemModule.findMany({
        where,
        select: MODULE_SELECT,
        // Mesma ordenação do legado: name ASC.
        orderBy: [{ name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.systemModule.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    };
  }

  /** Módulos disponíveis para abrir chamado — somente ativos (regra da Fase 04). */
  async listActive(): Promise<SystemModuleResponse[]> {
    return this.prisma.systemModule.findMany({
      where: { isActive: true },
      select: MODULE_SELECT,
      orderBy: [{ name: 'asc' }],
    });
  }

  async findOne(id: number): Promise<SystemModuleResponse> {
    const systemModule = await this.prisma.systemModule.findUnique({
      where: { id },
      select: MODULE_SELECT,
    });
    if (!systemModule) {
      throw new NotFoundException('Módulo não encontrado.');
    }
    return systemModule;
  }

  async create(dto: CreateSystemModuleDto): Promise<SystemModuleResponse> {
    await this.assertNameAvailable(dto.name);

    try {
      return await this.prisma.systemModule.create({
        data: { name: dto.name, isActive: dto.isActive ?? true },
        select: MODULE_SELECT,
      });
    } catch (error) {
      throw this.translateUniqueViolation(error);
    }
  }

  async update(id: number, dto: UpdateSystemModuleDto): Promise<SystemModuleResponse> {
    const existing = await this.prisma.systemModule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Módulo não encontrado.');
    }

    if (dto.name !== undefined && !equalsIgnoreCase(dto.name, existing.name)) {
      await this.assertNameAvailable(dto.name);
    }

    const data: Prisma.SystemModuleUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    try {
      return await this.prisma.systemModule.update({
        where: { id },
        data,
        select: MODULE_SELECT,
      });
    } catch (error) {
      throw this.translateUniqueViolation(error);
    }
  }

  /** `toggle_system_module` do legado: inverte a situação atual. */
  async toggle(id: number): Promise<SystemModuleResponse> {
    const existing = await this.prisma.systemModule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Módulo não encontrado.');
    }

    return this.prisma.systemModule.update({
      where: { id },
      data: { isActive: !existing.isActive },
      select: MODULE_SELECT,
    });
  }

  /**
   * O legado não expõe exclusão de módulo — só ativar/desativar. Mantemos a
   * exclusão apenas para módulos sem chamados, o que a FK RESTRICT já garante,
   * traduzindo o erro do banco numa 409 clara.
   */
  async remove(id: number): Promise<void> {
    const existing = await this.prisma.systemModule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Módulo não encontrado.');
    }

    const ticketCount = await this.prisma.ticket.count({
      where: { systemModuleId: id },
    });
    if (ticketCount > 0) {
      throw new ConflictException(
        'Não é possível excluir um módulo com chamados vinculados. ' +
          'Desative-o em vez de excluir.',
      );
    }

    await this.prisma.systemModule.delete({ where: { id } });
  }

  /**
   * Unicidade **case-insensitive**, como
   * `db.func.lower(SystemModule.name) == module_name.lower()` do legado.
   */
  private async assertNameAvailable(name: string): Promise<void> {
    const existing = await this.prisma.systemModule.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Já existe um módulo com este nome.');
    }
  }

  private translateUniqueViolation(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException('Já existe um módulo com este nome.');
    }
    return error;
  }
}

function equalsIgnoreCase(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
