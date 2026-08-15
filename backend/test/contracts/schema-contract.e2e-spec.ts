import { PrismaClient } from '@prisma/client';
import {
  createTestPrisma,
  seedBaseUsers,
  seedModule,
  truncateAll,
  FIXTURE_PASSWORD_HASH,
} from '../test-database';

/**
 * Fase 01 — testes de contrato do schema.
 *
 * Verificam contra um PostgreSQL real que o schema Prisma reproduz o legado:
 * nomes de tabela/coluna, constraints, relações e regras de exclusão.
 * Ver docs/LEGACY_CONTRACTS.md.
 */
describe('Contrato do schema legado', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createTestPrisma();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  describe('mapeamento de nomes', () => {
    it('usa exatamente os nomes de tabela do Flask-SQLAlchemy', async () => {
      const rows = await prisma.$queryRaw<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;
      const tables = rows.map((row) => row.table_name);

      expect(tables).toEqual(
        expect.arrayContaining([
          'activity',
          'payment_record',
          'refresh_token',
          'system_module',
          'system_parameter',
          'ticket',
          'user',
        ]),
      );
      // Nenhuma tabela em CamelCase ou plural.
      expect(tables).not.toContain('User');
      expect(tables).not.toContain('users');
      expect(tables).not.toContain('tickets');
    });

    it('usa exatamente os nomes de coluna do legado', async () => {
      const columnsOf = async (table: string) => {
        const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1 ORDER BY column_name`,
          table,
        );
        return rows.map((row) => row.column_name);
      };

      expect(await columnsOf('user')).toEqual([
        'email',
        'id',
        'is_superuser',
        'must_change_password',
        'name',
        'password_hash',
        'reset_token_expires_at',
        'reset_token_hash',
        'role',
      ]);

      expect(await columnsOf('ticket')).toEqual([
        'client_id',
        'created_at',
        'description',
        'id',
        'status',
        'system_module_id',
        'technician_id',
        'title',
      ]);

      expect(await columnsOf('activity')).toEqual([
        'created_by_id',
        'ended_at',
        'id',
        'notes',
        'started_at',
        'ticket_id',
      ]);

      expect(await columnsOf('payment_record')).toEqual([
        'amount',
        'created_at',
        'id',
        'paid_at',
        'paid_hours',
      ]);
    });

    it('não acrescenta updated_at às tabelas legadas', async () => {
      const rows = await prisma.$queryRaw<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'updated_at'
      `;
      expect(rows).toEqual([]);
    });
  });

  describe('tipos de coluna', () => {
    it('usa numeric para dinheiro e horas pagas, não double precision', async () => {
      const rows = await prisma.$queryRaw<
        { column_name: string; data_type: string; numeric_scale: number }[]
      >`
        SELECT column_name, data_type, numeric_scale FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payment_record'
          AND column_name IN ('amount', 'paid_hours')
        ORDER BY column_name
      `;

      expect(rows).toEqual([
        { column_name: 'amount', data_type: 'numeric', numeric_scale: 2 },
        { column_name: 'paid_hours', data_type: 'numeric', numeric_scale: 2 },
      ]);
    });

    it('mantém paid_at como date puro', async () => {
      const [row] = await prisma.$queryRaw<{ data_type: string }[]>`
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'payment_record' AND column_name = 'paid_at'
      `;
      expect(row.data_type).toBe('date');
    });

    it('mantém as colunas legadas como timestamp sem fuso', async () => {
      const rows = await prisma.$queryRaw<{ table_name: string; data_type: string }[]>`
        SELECT table_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (table_name, column_name) IN
              (('ticket', 'created_at'), ('activity', 'started_at'),
               ('activity', 'ended_at'), ('user', 'reset_token_expires_at'))
      `;
      for (const row of rows) {
        expect(row.data_type).toBe('timestamp without time zone');
      }
      expect(rows).toHaveLength(4);
    });

    it('usa timestamptz na tabela nova refresh_token', async () => {
      const rows = await prisma.$queryRaw<{ data_type: string }[]>`
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'refresh_token'
          AND column_name IN ('expires_at', 'revoked_at', 'created_at')
      `;
      for (const row of rows) {
        expect(row.data_type).toBe('timestamp with time zone');
      }
    });
  });

  describe('constraints de unicidade', () => {
    it('rejeita e-mail duplicado', async () => {
      await seedBaseUsers(prisma);
      await expect(
        prisma.user.create({
          data: {
            name: 'Outro',
            email: 'cliente1@example.com',
            passwordHash: FIXTURE_PASSWORD_HASH,
            role: 'client',
          },
        }),
      ).rejects.toThrow(/Unique constraint/i);
    });

    it('rejeita nome de módulo duplicado', async () => {
      await seedModule(prisma, 'Financeiro');
      await expect(seedModule(prisma, 'Financeiro')).rejects.toThrow(
        /Unique constraint/i,
      );
    });

    it('rejeita chave de parâmetro duplicada', async () => {
      await prisma.systemParameter.create({
        data: { key: 'company_name', value: 'Hope Desk' },
      });
      await expect(
        prisma.systemParameter.create({
          data: { key: 'company_name', value: 'Outro' },
        }),
      ).rejects.toThrow(/Unique constraint/i);
    });
  });

  describe('CHECK constraints de domínio', () => {
    it('rejeita role fora de client|technician', async () => {
      await expect(
        prisma.user.create({
          data: {
            name: 'Inválido',
            email: 'invalido@example.com',
            passwordHash: FIXTURE_PASSWORD_HASH,
            role: 'admin',
          },
        }),
      ).rejects.toThrow(/user_role_check|constraint/i);
    });

    it.each(['client', 'technician'])('aceita role %s', async (role) => {
      const user = await prisma.user.create({
        data: {
          name: `Usuario ${role}`,
          email: `${role}@example.com`,
          passwordHash: FIXTURE_PASSWORD_HASH,
          role,
        },
      });
      expect(user.role).toBe(role);
    });

    it('rejeita status fora dos quatro valores do legado', async () => {
      const { client } = await seedBaseUsers(prisma);
      await expect(
        prisma.ticket.create({
          data: {
            title: 'Chamado',
            description: 'Descrição',
            status: 'cancelado',
            clientId: client.id,
          },
        }),
      ).rejects.toThrow(/ticket_status_check|constraint/i);
    });

    it.each(['aberto', 'em_andamento', 'resolvido', 'fechado'])(
      'aceita status %s',
      async (status) => {
        const { client } = await seedBaseUsers(prisma);
        const ticket = await prisma.ticket.create({
          data: {
            title: 'Chamado',
            description: 'Descrição',
            status,
            clientId: client.id,
          },
        });
        expect(ticket.status).toBe(status);
      },
    );

    it('aplica aberto como status padrão', async () => {
      const { client } = await seedBaseUsers(prisma);
      const ticket = await prisma.ticket.create({
        data: { title: 'Chamado', description: 'Descrição', clientId: client.id },
      });
      expect(ticket.status).toBe('aberto');
    });

    it('rejeita atividade com fim anterior ou igual ao início', async () => {
      const { client, technician } = await seedBaseUsers(prisma);
      const ticket = await prisma.ticket.create({
        data: { title: 'Chamado', description: 'Descrição', clientId: client.id },
      });

      const sameInstant = new Date(Date.UTC(2026, 2, 10, 8, 0, 0));
      await expect(
        prisma.activity.create({
          data: {
            ticketId: ticket.id,
            notes: 'Intervalo nulo',
            startedAt: sameInstant,
            endedAt: sameInstant,
            createdById: technician.id,
          },
        }),
      ).rejects.toThrow(/activity_period_check|constraint/i);

      await expect(
        prisma.activity.create({
          data: {
            ticketId: ticket.id,
            notes: 'Intervalo invertido',
            startedAt: new Date(Date.UTC(2026, 2, 10, 10, 0, 0)),
            endedAt: new Date(Date.UTC(2026, 2, 10, 8, 0, 0)),
            createdById: technician.id,
          },
        }),
      ).rejects.toThrow(/activity_period_check|constraint/i);
    });

    it('rejeita pagamento com valor negativo', async () => {
      await expect(
        prisma.paymentRecord.create({
          data: { paidAt: new Date(Date.UTC(2026, 2, 10)), amount: -1, paidHours: 0 },
        }),
      ).rejects.toThrow(/amount_check|constraint/i);

      await expect(
        prisma.paymentRecord.create({
          data: { paidAt: new Date(Date.UTC(2026, 2, 10)), amount: 0, paidHours: -1 },
        }),
      ).rejects.toThrow(/paid_hours_check|constraint/i);
    });
  });

  describe('relações', () => {
    it('exige cliente no chamado e aceita técnico e módulo nulos', async () => {
      const { client } = await seedBaseUsers(prisma);
      const ticket = await prisma.ticket.create({
        data: { title: 'Sem técnico', description: 'Descrição', clientId: client.id },
      });
      expect(ticket.technicianId).toBeNull();
      expect(ticket.systemModuleId).toBeNull();
    });

    it('rejeita chamado com cliente inexistente', async () => {
      await expect(
        prisma.ticket.create({
          data: { title: 'Órfão', description: 'Descrição', clientId: 99999 },
        }),
      ).rejects.toThrow(/Foreign key constraint|constraint/i);
    });

    it('distingue as duas FKs de ticket para user', async () => {
      const { client, technician } = await seedBaseUsers(prisma);
      const ticket = await prisma.ticket.create({
        data: {
          title: 'Com técnico',
          description: 'Descrição',
          clientId: client.id,
          technicianId: technician.id,
        },
        include: { client: true, technician: true },
      });

      expect(ticket.client.email).toBe('cliente1@example.com');
      expect(ticket.technician?.email).toBe('tecnico1@example.com');
    });

    it('liga chamado a módulo do sistema', async () => {
      const { client } = await seedBaseUsers(prisma);
      const systemModule = await seedModule(prisma, 'Estoque');
      const ticket = await prisma.ticket.create({
        data: {
          title: 'Com módulo',
          description: 'Descrição',
          clientId: client.id,
          systemModuleId: systemModule.id,
        },
        include: { systemModule: true },
      });
      expect(ticket.systemModule?.name).toBe('Estoque');
    });
  });

  describe('regras de exclusão', () => {
    it('exclui as atividades em cascata ao excluir o chamado', async () => {
      const { client, technician } = await seedBaseUsers(prisma);
      const ticket = await prisma.ticket.create({
        data: { title: 'Chamado', description: 'Descrição', clientId: client.id },
      });
      await prisma.activity.create({
        data: {
          ticketId: ticket.id,
          notes: 'Atividade',
          startedAt: new Date(Date.UTC(2026, 2, 10, 8, 0, 0)),
          endedAt: new Date(Date.UTC(2026, 2, 10, 10, 0, 0)),
          createdById: technician.id,
        },
      });

      await prisma.ticket.delete({ where: { id: ticket.id } });

      expect(await prisma.activity.count()).toBe(0);
    });

    it('bloqueia exclusão de usuário com chamados vinculados', async () => {
      const { client } = await seedBaseUsers(prisma);
      await prisma.ticket.create({
        data: { title: 'Chamado', description: 'Descrição', clientId: client.id },
      });

      await expect(prisma.user.delete({ where: { id: client.id } })).rejects.toThrow(
        /Foreign key constraint|constraint/i,
      );
    });

    it('bloqueia exclusão de usuário com atividades vinculadas', async () => {
      const { client, technician } = await seedBaseUsers(prisma);
      const ticket = await prisma.ticket.create({
        data: { title: 'Chamado', description: 'Descrição', clientId: client.id },
      });
      await prisma.activity.create({
        data: {
          ticketId: ticket.id,
          notes: 'Atividade',
          startedAt: new Date(Date.UTC(2026, 2, 10, 8, 0, 0)),
          endedAt: new Date(Date.UTC(2026, 2, 10, 10, 0, 0)),
          createdById: technician.id,
        },
      });

      await expect(
        prisma.user.delete({ where: { id: technician.id } }),
      ).rejects.toThrow(/Foreign key constraint|constraint/i);
    });

    it('bloqueia exclusão de módulo com chamados vinculados', async () => {
      const { client } = await seedBaseUsers(prisma);
      const systemModule = await seedModule(prisma);
      await prisma.ticket.create({
        data: {
          title: 'Chamado',
          description: 'Descrição',
          clientId: client.id,
          systemModuleId: systemModule.id,
        },
      });

      await expect(
        prisma.systemModule.delete({ where: { id: systemModule.id } }),
      ).rejects.toThrow(/Foreign key constraint|constraint/i);
    });

    it('permite excluir usuário sem vínculos', async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Sem vínculos',
          email: 'livre@example.com',
          passwordHash: FIXTURE_PASSWORD_HASH,
          role: 'client',
        },
      });
      await prisma.user.delete({ where: { id: user.id } });
      expect(await prisma.user.count()).toBe(0);
    });

    it('exclui refresh tokens em cascata ao excluir o usuário', async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Com sessão',
          email: 'sessao@example.com',
          passwordHash: FIXTURE_PASSWORD_HASH,
          role: 'client',
        },
      });
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          jti: 'jti-de-teste',
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });

      await prisma.user.delete({ where: { id: user.id } });
      expect(await prisma.refreshToken.count()).toBe(0);
    });
  });

  describe('semântica de tempo', () => {
    it('grava hora de parede da atividade byte a byte como o legado', async () => {
      const { client, technician } = await seedBaseUsers(prisma);
      const ticket = await prisma.ticket.create({
        data: { title: 'Chamado', description: 'Descrição', clientId: client.id },
      });

      // "UTC fictício": 2026-03-10T08:30 de parede em São Paulo.
      await prisma.activity.create({
        data: {
          ticketId: ticket.id,
          notes: 'Atividade',
          startedAt: new Date('2026-03-10T08:30:00.000Z'),
          endedAt: new Date('2026-03-10T10:30:00.000Z'),
          createdById: technician.id,
        },
      });

      const [row] = await prisma.$queryRaw<{ started_text: string }[]>`
        SELECT to_char(started_at, 'YYYY-MM-DD HH24:MI:SS') AS started_text
        FROM activity LIMIT 1
      `;
      // Exatamente o que o Flask gravaria a partir de um <input datetime-local>.
      expect(row.started_text).toBe('2026-03-10 08:30:00');
    });

    it('usa UTC no default de created_at, independente do TimeZone da sessão', async () => {
      const { client } = await seedBaseUsers(prisma);
      // Sessão deliberadamente em outro fuso: o default deve continuar UTC.
      await prisma.$executeRawUnsafe(`SET TIME ZONE 'America/Sao_Paulo'`);
      const ticket = await prisma.ticket.create({
        data: { title: 'Chamado', description: 'Descrição', clientId: client.id },
      });
      await prisma.$executeRawUnsafe(`SET TIME ZONE 'UTC'`);

      const driftMs = Math.abs(Date.now() - ticket.createdAt.getTime());
      // Se o default seguisse a sessão, o desvio seria de ~3 horas.
      expect(driftMs).toBeLessThan(60_000);
    });
  });

  describe('preservação de IDs', () => {
    it('aceita IDs explícitos e permite reposicionar a sequência', async () => {
      // Simula a migração da Fase 12: IDs vindos da base legada.
      await prisma.user.create({
        data: {
          id: 500,
          name: 'Legado',
          email: 'legado@example.com',
          passwordHash: FIXTURE_PASSWORD_HASH,
          role: 'client',
        },
      });

      await prisma.$executeRawUnsafe(`
        SELECT setval(pg_get_serial_sequence('"user"', 'id'),
                      COALESCE((SELECT MAX(id) FROM "user"), 1))
      `);

      const next = await prisma.user.create({
        data: {
          name: 'Novo',
          email: 'novo@example.com',
          passwordHash: FIXTURE_PASSWORD_HASH,
          role: 'client',
        },
      });

      expect(next.id).toBe(501);
    });
  });

  describe('precisão decimal', () => {
    it('preserva centavos exatos em amount e paid_hours', async () => {
      const payment = await prisma.paymentRecord.create({
        data: {
          paidAt: new Date(Date.UTC(2026, 2, 10)),
          amount: '1234.56',
          paidHours: '10.25',
        },
      });

      expect(payment.amount.toString()).toBe('1234.56');
      expect(payment.paidHours.toString()).toBe('10.25');
      // Soma decimal exata, sem erro de ponto flutuante.
      expect(payment.amount.plus(payment.paidHours).toString()).toBe('1244.81');
    });

    it('arredonda para 2 casas na escala da coluna', async () => {
      const payment = await prisma.paymentRecord.create({
        data: {
          paidAt: new Date(Date.UTC(2026, 2, 10)),
          amount: '0.005',
          paidHours: '0.004',
        },
      });
      expect(payment.amount.toString()).toBe('0.01');
      expect(payment.paidHours.toString()).toBe('0');
    });
  });
});
