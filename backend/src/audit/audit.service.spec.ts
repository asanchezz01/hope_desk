import { runWithRequestContext } from '../common/observability/request-context';
import { PrismaService } from '../prisma/prisma.service';

import { AuditService } from './audit.service';
import { AUDIT_ACTIONS } from './audit.types';

interface CapturedCreate {
  data: Record<string, unknown>;
}

function buildService(options: { failOnCreate?: boolean } = {}) {
  const created: CapturedCreate[] = [];

  const prisma = {
    auditLog: {
      create: jest.fn(async (args: CapturedCreate) => {
        if (options.failOnCreate) throw new Error('banco indisponível');
        created.push(args);
        return { id: created.length };
      }),
    },
  } as unknown as PrismaService;

  return { service: new AuditService(prisma), created, prisma };
}

describe('AuditService', () => {
  it('grava a ação com o contexto da requisição', async () => {
    const { service, created } = buildService();

    await runWithRequestContext(
      { correlationId: 'req-abc12345', userId: 9, ip: '10.0.0.1' },
      async () => {
        await service.record({
          action: AUDIT_ACTIONS.PAYMENT_DELETED,
          entityType: 'payment',
          entityId: 42,
        });
      },
    );

    expect(created).toHaveLength(1);
    expect(created[0].data).toMatchObject({
      action: 'payment.deleted',
      entityType: 'payment',
      entityId: 42,
      actorId: 9,
      correlationId: 'req-abc12345',
      ipAddress: '10.0.0.1',
    });
  });

  it('deixa o ator explícito vencer o contexto — o caso do login falho', async () => {
    const { service, created } = buildService();

    await runWithRequestContext(
      { correlationId: 'req-abc12345', userId: 9 },
      async () => {
        await service.record({
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          actorId: null,
          actorEmail: 'tentativa@exemplo.com',
        });
      },
    );

    expect(created[0].data.actorId).toBeNull();
    expect(created[0].data.actorEmail).toBe('tentativa@exemplo.com');
  });

  it('funciona fora de uma requisição', async () => {
    // Seed e scripts rodam sem contexto; não pode lançar.
    const { service, created } = buildService();
    await service.record({ action: AUDIT_ACTIONS.PARAMETERS_UPDATED });
    expect(created[0].data.correlationId).toBeNull();
  });

  describe('saneamento de metadata', () => {
    it('omite qualquer chave que sugira segredo', async () => {
      const { service, created } = buildService();

      await service.record({
        action: AUDIT_ACTIONS.USER_UPDATED,
        metadata: {
          email: 'alguem@exemplo.com',
          password: 'senha-em-claro',
          newPassword: 'outra',
          passwordHash: 'scrypt:32768:8:1$...',
          resetToken: 'abc',
          refreshToken: 'def',
          senha: 'pt-br',
          authorization: 'Bearer x',
          apiSecret: 'y',
        },
      });

      const metadata = created[0].data.metadata as Record<string, unknown>;
      // O que não é segredo passa.
      expect(metadata.email).toBe('alguem@exemplo.com');
      // Tudo o que é, some — a trilha seria o último lugar onde alguém
      // procuraria por um vazamento.
      for (const key of [
        'password',
        'newPassword',
        'passwordHash',
        'resetToken',
        'refreshToken',
        'senha',
        'authorization',
        'apiSecret',
      ]) {
        expect(metadata[key]).toBe('[omitido]');
      }
    });

    it('preserva booleano mesmo em chave bloqueada', async () => {
      // `rehashed` contém "hash" no nome e é um booleano: não há segredo
      // possível ali, e omiti-lo apagava a única informação útil do registro.
      // Foi assim que a trilha gravou `"rehashed": "[omitido]"` desde a Fase 11.
      const { service, created } = buildService();

      await service.record({
        action: AUDIT_ACTIONS.LOGIN_SUCCEEDED,
        metadata: { rehashed: false, rehashPending: true, passwordHash: 'segredo' },
      });

      const metadata = created[0].data.metadata as Record<string, unknown>;
      expect(metadata.rehashed).toBe(false);
      expect(metadata.rehashPending).toBe(true);
      // O que é string continua omitido.
      expect(metadata.passwordHash).toBe('[omitido]');
    });

    it('não percorre objetos aninhados', async () => {
      // Objeto aninhado é a forma mais fácil de um segredo escapar da lista de
      // bloqueio; vira uma marca legível em vez de ser inspecionado.
      const { service, created } = buildService();

      await service.record({
        action: AUDIT_ACTIONS.USER_UPDATED,
        metadata: { dto: { password: 'escaparia' }, itens: [1, 2, 3] },
      });

      const metadata = created[0].data.metadata as Record<string, unknown>;
      expect(metadata.dto).toBe('[objeto]');
      expect(metadata.itens).toBe('[3 itens]');
    });

    it('corta valores longos', async () => {
      const { service, created } = buildService();
      await service.record({
        action: AUDIT_ACTIONS.TICKET_DELETED,
        metadata: { title: 'x'.repeat(2000) },
      });

      const metadata = created[0].data.metadata as Record<string, unknown>;
      expect((metadata.title as string).length).toBeLessThanOrEqual(501);
      expect(metadata.title as string).toMatch(/…$/);
    });

    it('preserva números e booleanos', async () => {
      const { service, created } = buildService();
      await service.record({
        action: AUDIT_ACTIONS.MODULE_TOGGLED,
        metadata: { isActive: false, ticketCount: 0 },
      });

      const metadata = created[0].data.metadata as Record<string, unknown>;
      expect(metadata.isActive).toBe(false);
      expect(metadata.ticketCount).toBe(0);
    });
  });

  it('NUNCA lança quando a gravação falha', async () => {
    // Decisão registrada no service: perder um registro é melhor que abortar a
    // operação de negócio. A falha vai para o log de erro.
    const { service, prisma } = buildService({ failOnCreate: true });
    const logged = jest
      .spyOn(service['logger'], 'error')
      .mockImplementation(() => undefined);

    await expect(
      service.record({ action: AUDIT_ACTIONS.TICKET_DELETED, entityId: 1 }),
    ).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
