import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { getRequestContext } from '../common/observability/request-context';
import { PrismaService } from '../prisma/prisma.service';

import { AuditEntry } from './audit.types';
import { ListAuditQueryDto, PaginatedAuditResponse } from './dto/audit.dto';

/**
 * Chaves que nunca podem chegar ao banco, mesmo que alguém as inclua no
 * `metadata` por engano. A comparação é por substring e sem acento de caixa,
 * porque o erro real é `newPassword`, `password_hash`, `resetToken` — variações
 * do mesmo tema.
 */
const BLOCKED_METADATA_KEYS = [
  'password',
  'senha',
  'hash',
  'token',
  'secret',
  'authorization',
  'cookie',
];

/** Corta valores longos: auditoria não é lugar de guardar corpo de requisição. */
const MAX_VALUE_LENGTH = 500;

const DEFAULT_PAGE_SIZE = 50;
/** Teto de página: a trilha cresce sem parar, e um `pageSize` alto varre tudo. */
const MAX_PAGE_SIZE = 200;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra uma ação auditável.
   *
   * **Nunca lança.** A escolha é deliberada e tem custo: uma falha de gravação
   * deixa buraco na trilha em vez de abortar a operação. Para um sistema de
   * chamados interno, recusar uma exclusão legítima porque o INSERT de
   * auditoria falhou é pior do que perder o registro — e a falha é registrada
   * em log de erro, que o coletor pega. Um sistema com exigência regulatória
   * inverteria essa decisão.
   */
  async record(entry: AuditEntry): Promise<void> {
    const context = getRequestContext();

    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          // `actorId` explícito vence o contexto: no login falho não há usuário
          // autenticado, mas o e-mail tentado interessa.
          actorId:
            entry.actorId !== undefined ? entry.actorId : (context?.userId ?? null),
          actorEmail: entry.actorEmail ?? null,
          correlationId: context?.correlationId ?? null,
          ipAddress: context?.ip ?? null,
          // `Prisma.InputJsonValue` e o tipo aceito pela coluna Json; o
          // `Record<string, unknown>` do sanitize e compativel em forma, mas
          // o Prisma exige o tipo nominal.
          metadata: (this.sanitize(entry.metadata) ?? undefined) as
            Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      this.logger.error(
        `Falha ao gravar auditoria de ${entry.action}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Consulta a trilha (superuser).
   *
   * Sem leitura, a auditoria só serviria a quem tem acesso ao banco — e uma
   * trilha que ninguém consulta não responde à pergunta que justifica mantê-la
   * ("quem excluiu este chamado?").
   */
  async list(query: ListAuditQueryDto): Promise<PaginatedAuditResponse> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(
      Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );

    const createdAt =
      query.from || query.to
        ? {
            // Início inclusivo e fim EXCLUSIVO, como nos filtros de período de
            // chamados: com o fim inclusivo, "até 31/08" perderia tudo o que
            // aconteceu depois de 00:00 daquele dia.
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lt: new Date(query.to) } : {}),
          }
        : undefined;

    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(createdAt ? { createdAt } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        // O desempate por `id` não é decorativo: vários registros podem cair no
        // mesmo instante, e sem ele a mesma linha apareceria em duas páginas
        // enquanto outra sumiria.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { id: true, name: true } } },
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        actor: {
          id: row.actorId,
          // O e-mail vem da cópia histórica, não do usuário atual: é o que
          // sobrevive à exclusão da conta.
          email: row.actorEmail,
          name: row.actor?.name ?? null,
        },
        entityType: row.entityType,
        entityId: row.entityId,
        correlationId: row.correlationId,
        ipAddress: row.ipAddress,
        metadata: (row.metadata as Record<string, unknown> | null) ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /**
   * Remove segredos e corta valores longos.
   *
   * Sem isto, bastaria alguém passar o DTO inteiro no `metadata` para a senha
   * em claro acabar gravada — e uma trilha de auditoria é justamente o lugar
   * onde ninguém procuraria por um vazamento.
   */
  private sanitize(
    metadata: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined {
    if (!metadata) return undefined;

    const clean: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      const normalizedKey = key.toLowerCase();
      const blocked = BLOCKED_METADATA_KEYS.some((term) =>
        normalizedKey.includes(term),
      );

      // Booleano em chave bloqueada é preservado: `true`/`false` não conseguem
      // carregar segredo nenhum, e omiti-los destrói informação real. Foi o que
      // aconteceu com `rehashed`, gravado como "[omitido]" desde a Fase 11
      // porque a palavra "hash" aparece no NOME do campo — a trilha registrava
      // que houve login e escondia justamente o que interessava saber.
      //
      // String e número continuam omitidos: um token numérico de seis dígitos
      // é exatamente o tipo de coisa que a lista existe para pegar.
      if (blocked && typeof value !== 'boolean') {
        clean[key] = '[omitido]';
        continue;
      }

      if (typeof value === 'string' && value.length > MAX_VALUE_LENGTH) {
        clean[key] = `${value.slice(0, MAX_VALUE_LENGTH)}…`;
        continue;
      }

      // Objetos aninhados não são percorridos: eles são a forma mais fácil de
      // um segredo escapar da lista de bloqueio. Vira uma marca legível.
      if (value !== null && typeof value === 'object') {
        clean[key] = Array.isArray(value) ? `[${value.length} itens]` : '[objeto]';
        continue;
      }

      clean[key] = value;
    }

    return clean;
  }
}
