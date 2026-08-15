import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.types';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

    let created: SystemModuleResponse;
    try {
      created = await this.prisma.systemModule.create({
        data: { name: dto.name, isActive: dto.isActive ?? true },
        select: MODULE_SELECT,
      });
    } catch (error) {
      throw this.translateUniqueViolation(error);
    }

    // O par de `toggle` e `delete` já estava na trilha; sem a criação, ela
    // registraria o fim da vida de um módulo mas não o começo.
    await this.audit.record({
      action: AUDIT_ACTIONS.MODULE_CREATED,
      entityType: 'system_module',
      entityId: created.id,
      metadata: { name: created.name, isActive: created.isActive },
    });

    return created;
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

    let updated: SystemModuleResponse;
    try {
      updated = await this.prisma.systemModule.update({
        where: { id },
        data,
        select: MODULE_SELECT,
      });
    } catch (error) {
      throw this.translateUniqueViolation(error);
    }

    await this.audit.record({
      action: AUDIT_ACTIONS.MODULE_UPDATED,
      entityType: 'system_module',
      entityId: id,
      metadata: {
        // Renomear um módulo muda o que aparece no histórico de todo chamado
        // ligado a ele — daí guardar o nome anterior, e não só o novo.
        fromName: existing.name,
        toName: updated.name,
        fromActive: existing.isActive,
        toActive: updated.isActive,
      },
    });

    return updated;
  }

  /** `toggle_system_module` do legado: inverte a situação atual. */
  async toggle(id: number): Promise<SystemModuleResponse> {
    const existing = await this.prisma.systemModule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Módulo não encontrado.');
    }

    const updated = await this.prisma.systemModule.update({
      where: { id },
      data: { isActive: !existing.isActive },
      select: MODULE_SELECT,
    });

    // Desativar um modulo tira a opcao de abrir chamado nele -- muda o que a
    // operacao consegue fazer, entao entra na trilha.
    await this.audit.record({
      action: AUDIT_ACTIONS.MODULE_TOGGLED,
      entityType: 'system_module',
      entityId: id,
      metadata: { name: existing.name, isActive: updated.isActive },
    });

    return updated;
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

    await this.audit.record({
      action: AUDIT_ACTIONS.MODULE_DELETED,
      entityType: 'system_module',
      entityId: id,
      metadata: { name: existing.name },
    });
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
