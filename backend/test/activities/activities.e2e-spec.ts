import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { PasswordService } from '../../src/auth/password/password.service';
import {
  ACTIVITY_CREATED,
  ActivityCreatedEvent,
} from '../../src/common/events/domain-events';
import { DomainEventsService } from '../../src/common/events/domain-events.service';
import { parseWallClockInput } from '../../src/common/time/legacy-clock';
import { MailerService } from '../../src/notifications/mailer.service';
import { API, createTestHarness } from '../app-harness';
import { truncateAll } from '../test-database';

/**
 * Fase 05 — atividades e conflitos de horário.
 */
describe('Atividades (Fase 05)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let events: DomainEventsService;
  let mailer: MailerService;

  const PASSWORD = 'Senha@123';

  let clientAToken: string;
  let clientBToken: string;
  let technicianAToken: string;
  let technicianBToken: string;
  let superuserToken: string;

  let clientAId: number;
  let clientBId: number;
  let technicianAId: number;
  let technicianBId: number;
  let superuserId: number;
  let moduleId: number;
  let ticketId: number;
  let otherTicketId: number;

  beforeAll(async () => {
    const harness = await createTestHarness();
    app = harness.app;
    prisma = harness.prisma;
    close = harness.close;
    events = app.get(DomainEventsService);
    mailer = app.get(MailerService);
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    mailer.clearCaptured();

    const passwordHash = await new PasswordService().hash(PASSWORD);
    const [clientA, clientB, technicianA, technicianB, superuser] = await Promise.all([
      prisma.user.create({
        data: {
          name: 'Cliente A',
          email: 'ca@example.com',
          passwordHash,
          role: 'client',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Cliente B',
          email: 'cb@example.com',
          passwordHash,
          role: 'client',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Ana Tecnica',
          email: 'ana@example.com',
          passwordHash,
          role: 'technician',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Bruno Tecnico',
          email: 'bruno@example.com',
          passwordHash,
          role: 'technician',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Super User',
          email: 'super@example.com',
          passwordHash,
          role: 'technician',
          isSuperuser: true,
        },
      }),
    ]);

    clientAId = clientA.id;
    clientBId = clientB.id;
    technicianAId = technicianA.id;
    technicianBId = technicianB.id;
    superuserId = superuser.id;

    const systemModule = await prisma.systemModule.create({
      data: { name: 'Financeiro' },
    });
    moduleId = systemModule.id;

    const [ticket, otherTicket] = await Promise.all([
      prisma.ticket.create({
        data: {
          title: 'Chamado do Cliente A',
          description: 'Descrição',
          clientId: clientAId,
          systemModuleId: moduleId,
        },
      }),
      prisma.ticket.create({
        data: {
          title: 'Chamado do Cliente B',
          description: 'Descrição',
          clientId: clientBId,
          systemModuleId: moduleId,
        },
      }),
    ]);
    ticketId = ticket.id;
    otherTicketId = otherTicket.id;

    [clientAToken, clientBToken, technicianAToken, technicianBToken, superuserToken] =
      await Promise.all([
        loginAs('ca@example.com'),
        loginAs('cb@example.com'),
        loginAs('ana@example.com'),
        loginAs('bruno@example.com'),
        loginAs('super@example.com'),
      ]);
  });

  async function loginAs(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(200);
    return response.body.accessToken;
  }

  async function seedActivity(options: {
    ticketId?: number;
    createdById: number;
    startedAt: string;
    endedAt: string;
    notes?: string;
  }) {
    return prisma.activity.create({
      data: {
        ticketId: options.ticketId ?? ticketId,
        notes: options.notes ?? 'Atividade semeada',
        startedAt: parseWallClockInput(options.startedAt),
        endedAt: parseWallClockInput(options.endedAt),
        createdById: options.createdById,
      },
    });
  }

  const validBody = () => ({
    notes: 'Troquei o toner da impressora.',
    startedAt: '2026-03-10T08:00',
    endedAt: '2026-03-10T10:00',
  });

  // =========================================================================
  describe('POST — criação', () => {
    it('técnico registra atividade', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send(validBody())
        .expect(201);

      expect(response.body).toMatchObject({
        ticketId,
        notes: 'Troquei o toner da impressora.',
        startedAt: '2026-03-10T08:00:00',
        endedAt: '2026-03-10T10:00:00',
        startedLabel: '10/03/2026 08:00',
        endedLabel: '10/03/2026 10:00',
        durationHours: 2,
      });
      expect(response.body.createdBy.id).toBe(technicianAId);
    });

    it('grava a hora de parede byte a byte como o Flask', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send(validBody())
        .expect(201);

      const [row] = await prisma.$queryRaw<{ started_text: string }[]>`
        SELECT to_char(started_at, 'YYYY-MM-DD HH24:MI:SS') AS started_text
        FROM activity WHERE id = ${response.body.id}
      `;
      // Sem deslocamento de 3h: exatamente o que foi informado.
      expect(row.started_text).toBe('2026-03-10 08:00:00');
    });

    it('o autor é sempre o usuário autenticado', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianBToken}`)
        .send(validBody())
        .expect(201);

      expect(response.body.createdBy.id).toBe(technicianBId);
      expect(response.body.createdBy.name).toBe('Bruno Tecnico');
    });

    it('cliente NÃO registra atividade, nem no próprio chamado', async () => {
      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send(validBody())
        .expect(403);

      expect(await prisma.activity.count()).toBe(0);
    });

    it('superuser registra atividade', async () => {
      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send(validBody())
        .expect(201);
    });

    it('devolve 404 para chamado inexistente', async () => {
      await request(app.getHttpServer())
        .post(`${API}/tickets/999999/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send(validBody())
        .expect(404);
    });

    it.each([
      ['notes vazia', { notes: '' }],
      ['notes só com espaços', { notes: '   ' }],
    ])('recusa %s', async (_label, override) => {
      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send({ ...validBody(), ...override })
        .expect(400);
    });

    it('normaliza espaços em notes', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send({ ...validBody(), notes: '  Com espaços  ' })
        .expect(201);

      expect(response.body.notes).toBe('Com espaços');
    });

    it.each([
      ['data inexistente', '2026-02-30T10:00'],
      ['texto', 'não é data'],
      ['mês inválido', '2026-13-01T10:00'],
    ])('recusa início inválido: %s', async (_label, startedAt) => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send({ ...validBody(), startedAt })
        .expect(400);

      expect(response.body.message).toMatch(/datas inválidas/i);
    });

    it('recusa campos não declarados', async () => {
      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send({ ...validBody(), createdById: superuserId })
        .expect(400);
    });

    it('exige autenticação', async () => {
      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .send(validBody())
        .expect(401);
    });
  });

  // =========================================================================
  describe('regras temporais', () => {
    it('recusa fim IGUAL ao início', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send({
          ...validBody(),
          startedAt: '2026-03-10T08:00',
          endedAt: '2026-03-10T08:00',
        })
        .expect(400);

      expect(response.body.message).toMatch(/posterior à data\/hora de início/i);
    });

    it('recusa fim anterior ao início', async () => {
      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send({
          ...validBody(),
          startedAt: '2026-03-10T12:00',
          endedAt: '2026-03-10T08:00',
        })
        .expect(400);
    });

    it('aceita duração de EXATAMENTE 12 horas', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send({
          ...validBody(),
          startedAt: '2026-03-10T08:00',
          endedAt: '2026-03-10T20:00',
        })
        .expect(201);

      expect(response.body.durationHours).toBe(12);
    });

    it('recusa duração acima de 12 horas', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send({
          ...validBody(),
          startedAt: '2026-03-10T08:00',
          endedAt: '2026-03-10T20:01',
        })
        .expect(400);

      expect(response.body.message).toMatch(/superior a 12 horas/i);
    });

    it('aceita atividade que atravessa a virada do dia', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send({
          ...validBody(),
          startedAt: '2026-03-10T22:00',
          endedAt: '2026-03-11T02:00',
        })
        .expect(201);

      expect(response.body.durationHours).toBe(4);
    });

    it('aceita atividade que atravessa a virada do mês', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send({
          ...validBody(),
          startedAt: '2026-01-31T20:00',
          endedAt: '2026-02-01T04:00',
        })
        .expect(201);

      expect(response.body.durationHours).toBe(8);
    });

    it('aceita atividade que atravessa a virada do ano', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send({
          ...validBody(),
          startedAt: '2025-12-31T21:00',
          endedAt: '2026-01-01T05:00',
        })
        .expect(201);

      expect(response.body.durationHours).toBe(8);
    });

    it('o CHECK do banco também barra período inválido', async () => {
      // Defesa em profundidade: mesmo por acesso direto, o banco recusa.
      await expect(
        prisma.activity.create({
          data: {
            ticketId,
            notes: 'Inválida',
            startedAt: parseWallClockInput('2026-03-10T10:00'),
            endedAt: parseWallClockInput('2026-03-10T08:00'),
            createdById: technicianAId,
          },
        }),
      ).rejects.toThrow(/activity_period_check|constraint/i);
    });
  });

  // =========================================================================
  describe('detecção de conflito de horário', () => {
    beforeEach(async () => {
      // Atividade de referência da Ana: 10:00 → 12:00 de 10/03.
      await seedActivity({
        createdById: technicianAId,
        startedAt: '2026-03-10T10:00',
        endedAt: '2026-03-10T12:00',
      });
    });

    async function attempt(
      startedAt: string,
      endedAt: string,
      token = technicianAToken,
    ) {
      return request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Nova atividade', startedAt, endedAt });
    }

    it('intervalo IDÊNTICO conflita', async () => {
      const response = await attempt('2026-03-10T10:00', '2026-03-10T12:00');
      expect(response.status).toBe(409);
      expect(response.body.message).toMatch(/conflito de horário/i);
      expect(response.body.message).toContain('10/03/2026 10:00');
      expect(response.body.message).toContain('10/03/2026 12:00');
    });

    it('sobreposição TOTAL conflita (novo contém o existente)', async () => {
      expect((await attempt('2026-03-10T08:00', '2026-03-10T14:00')).status).toBe(409);
    });

    it('sobreposição TOTAL conflita (existente contém o novo)', async () => {
      expect((await attempt('2026-03-10T10:30', '2026-03-10T11:30')).status).toBe(409);
    });

    it('sobreposição PARCIAL pelo início conflita', async () => {
      expect((await attempt('2026-03-10T09:00', '2026-03-10T11:00')).status).toBe(409);
    });

    it('sobreposição PARCIAL pelo fim conflita', async () => {
      expect((await attempt('2026-03-10T11:00', '2026-03-10T13:00')).status).toBe(409);
    });

    it('intervalos ADJACENTES NÃO conflitam (antes)', async () => {
      expect((await attempt('2026-03-10T08:00', '2026-03-10T10:00')).status).toBe(201);
    });

    it('intervalos ADJACENTES NÃO conflitam (depois)', async () => {
      expect((await attempt('2026-03-10T12:00', '2026-03-10T14:00')).status).toBe(201);
    });

    it('sobreposição de um minuto conflita', async () => {
      expect((await attempt('2026-03-10T11:59', '2026-03-10T13:00')).status).toBe(409);
    });

    it('conflito de OUTRO técnico não bloqueia', async () => {
      // Bruno pode lançar exatamente no mesmo horário da Ana.
      expect(
        (await attempt('2026-03-10T10:00', '2026-03-10T12:00', technicianBToken))
          .status,
      ).toBe(201);
    });

    it('o conflito é GLOBAL por técnico: atravessa chamados', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets/${otherTicketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send({
          notes: 'Em outro chamado',
          startedAt: '2026-03-10T10:30',
          endedAt: '2026-03-10T11:30',
        })
        .expect(409);

      expect(response.body.message).toMatch(/conflito de horário/i);
    });

    it('detecta conflito na virada do dia', async () => {
      await seedActivity({
        createdById: technicianAId,
        startedAt: '2026-03-20T22:00',
        endedAt: '2026-03-21T02:00',
      });

      expect((await attempt('2026-03-21T01:00', '2026-03-21T03:00')).status).toBe(409);
    });

    it('detecta conflito na virada do mês', async () => {
      await seedActivity({
        createdById: technicianAId,
        startedAt: '2026-01-31T20:00',
        endedAt: '2026-02-01T04:00',
      });

      expect((await attempt('2026-02-01T02:00', '2026-02-01T06:00')).status).toBe(409);
    });

    it('reporta o PRIMEIRO conflito em ordem de início', async () => {
      // Já existe 10:00→12:00; acrescenta 14:00→16:00.
      await seedActivity({
        createdById: technicianAId,
        startedAt: '2026-03-10T14:00',
        endedAt: '2026-03-10T16:00',
      });

      const response = await attempt('2026-03-10T09:00', '2026-03-10T18:00');
      expect(response.status).toBe(409);
      // O de 10:00 vem antes do de 14:00.
      expect(response.body.message).toContain('10/03/2026 10:00');
      expect(response.body.message).not.toContain('14:00');
    });

    it('sem sobreposição, a criação passa', async () => {
      expect((await attempt('2026-03-11T10:00', '2026-03-11T12:00')).status).toBe(201);
    });
  });

  // =========================================================================
  describe('PATCH — edição', () => {
    let ownActivityId: number;
    let foreignActivityId: number;

    beforeEach(async () => {
      const own = await seedActivity({
        createdById: technicianAId,
        startedAt: '2026-03-10T10:00',
        endedAt: '2026-03-10T12:00',
        notes: 'Da Ana',
      });
      const foreign = await seedActivity({
        createdById: technicianBId,
        startedAt: '2026-03-15T10:00',
        endedAt: '2026-03-15T12:00',
        notes: 'Do Bruno',
      });
      ownActivityId = own.id;
      foreignActivityId = foreign.id;
    });

    const editBody = () => ({
      notes: 'Descrição atualizada',
      startedAt: '2026-03-10T09:00',
      endedAt: '2026-03-10T11:00',
    });

    it('o autor edita a própria atividade', async () => {
      const response = await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticketId}/activities/${ownActivityId}`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send(editBody())
        .expect(200);

      expect(response.body.notes).toBe('Descrição atualizada');
      expect(response.body.startedAt).toBe('2026-03-10T09:00:00');
      expect(response.body.durationHours).toBe(2);
    });

    it('a própria atividade sai da verificação de conflito', async () => {
      // Reenviar o mesmo intervalo não pode acusar conflito consigo mesma.
      await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticketId}/activities/${ownActivityId}`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send({
          notes: 'Só muda a descrição',
          startedAt: '2026-03-10T10:00',
          endedAt: '2026-03-10T12:00',
        })
        .expect(200);
    });

    it('outro técnico NÃO edita atividade alheia', async () => {
      const response = await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticketId}/activities/${ownActivityId}`)
        .set('Authorization', `Bearer ${technicianBToken}`)
        .send(editBody())
        .expect(403);

      expect(response.body.message).toMatch(/lançadas por você/i);
    });

    /**
     * A regra mais contraintuitiva do sistema: em todo o resto o superuser
     * contorna restrições, mas `edit_activity` não abre exceção.
     */
    it('SUPERUSER não edita atividade de outro técnico', async () => {
      await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticketId}/activities/${ownActivityId}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send(editBody())
        .expect(403);

      const unchanged = await prisma.activity.findUniqueOrThrow({
        where: { id: ownActivityId },
      });
      expect(unchanged.notes).toBe('Da Ana');
    });

    it('cliente não edita atividade', async () => {
      await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticketId}/activities/${ownActivityId}`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send(editBody())
        .expect(403);
    });

    it('a edição também valida o período', async () => {
      await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticketId}/activities/${ownActivityId}`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send({
          notes: 'Longa demais',
          startedAt: '2026-03-10T08:00',
          endedAt: '2026-03-10T21:00',
        })
        .expect(400);
    });

    it('a edição detecta conflito com OUTRA atividade do mesmo técnico', async () => {
      await seedActivity({
        createdById: technicianAId,
        startedAt: '2026-03-12T10:00',
        endedAt: '2026-03-12T12:00',
      });

      await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticketId}/activities/${ownActivityId}`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send({
          notes: 'Colidindo',
          startedAt: '2026-03-12T11:00',
          endedAt: '2026-03-12T13:00',
        })
        .expect(409);
    });

    it('devolve 404 para atividade de OUTRO chamado', async () => {
      // A atividade existe, mas não pertence ao chamado informado.
      await request(app.getHttpServer())
        .patch(`${API}/tickets/${otherTicketId}/activities/${ownActivityId}`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send(editBody())
        .expect(404);
    });

    it('devolve 404 para atividade inexistente', async () => {
      await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticketId}/activities/999999`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send(editBody())
        .expect(404);
    });

    it('o autor do Bruno edita a atividade dele', async () => {
      await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticketId}/activities/${foreignActivityId}`)
        .set('Authorization', `Bearer ${technicianBToken}`)
        .send({
          notes: 'Atualizada pelo Bruno',
          startedAt: '2026-03-15T09:00',
          endedAt: '2026-03-15T11:00',
        })
        .expect(200);
    });
  });

  // =========================================================================
  describe('DELETE — janela de exclusão', () => {
    function currentMonthWallClock(): string {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      // Dia 10 às 08:00 do mês corrente, longe das bordas.
      return `${year}-${month}-10T08:00`;
    }

    function currentMonthEnd(): string {
      return currentMonthWallClock().replace('T08:00', 'T10:00');
    }

    it('técnico exclui atividade do mês corrente', async () => {
      const activity = await seedActivity({
        createdById: technicianAId,
        startedAt: currentMonthWallClock(),
        endedAt: currentMonthEnd(),
      });

      await request(app.getHttpServer())
        .delete(`${API}/tickets/${ticketId}/activities/${activity.id}`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .expect(204);

      expect(await prisma.activity.count({ where: { id: activity.id } })).toBe(0);
    });

    it('técnico exclui atividade do mês corrente lançada por OUTRO', async () => {
      // Diferente da edição, o legado não exige autoria para excluir.
      const activity = await seedActivity({
        createdById: technicianBId,
        startedAt: currentMonthWallClock(),
        endedAt: currentMonthEnd(),
      });

      await request(app.getHttpServer())
        .delete(`${API}/tickets/${ticketId}/activities/${activity.id}`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .expect(204);
    });

    it('técnico NÃO exclui atividade histórica', async () => {
      const activity = await seedActivity({
        createdById: technicianAId,
        startedAt: '2020-01-10T08:00',
        endedAt: '2020-01-10T10:00',
      });

      const response = await request(app.getHttpServer())
        .delete(`${API}/tickets/${ticketId}/activities/${activity.id}`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .expect(403);

      expect(response.body.message).toMatch(/mês corrente/i);
      expect(await prisma.activity.count({ where: { id: activity.id } })).toBe(1);
    });

    it('superuser exclui atividade histórica', async () => {
      const activity = await seedActivity({
        createdById: technicianAId,
        startedAt: '2020-01-10T08:00',
        endedAt: '2020-01-10T10:00',
      });

      await request(app.getHttpServer())
        .delete(`${API}/tickets/${ticketId}/activities/${activity.id}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(204);
    });

    it('cliente nunca exclui', async () => {
      const activity = await seedActivity({
        createdById: technicianAId,
        startedAt: currentMonthWallClock(),
        endedAt: currentMonthEnd(),
      });

      await request(app.getHttpServer())
        .delete(`${API}/tickets/${ticketId}/activities/${activity.id}`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(403);

      expect(await prisma.activity.count({ where: { id: activity.id } })).toBe(1);
    });

    it('devolve 404 para atividade de outro chamado', async () => {
      const activity = await seedActivity({
        createdById: technicianAId,
        startedAt: currentMonthWallClock(),
        endedAt: currentMonthEnd(),
      });

      await request(app.getHttpServer())
        .delete(`${API}/tickets/${otherTicketId}/activities/${activity.id}`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .expect(404);
    });
  });

  // =========================================================================
  describe('GET — listagem e isolamento por cliente', () => {
    beforeEach(async () => {
      await seedActivity({
        createdById: technicianAId,
        startedAt: '2026-03-10T14:00',
        endedAt: '2026-03-10T16:00',
        notes: 'Segunda',
      });
      await seedActivity({
        createdById: technicianBId,
        startedAt: '2026-03-10T08:00',
        endedAt: '2026-03-10T12:00',
        notes: 'Primeira',
      });
    });

    it('lista ordenada por início ascendente, com o total de horas', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .expect(200);

      expect(response.body.items.map((item: { notes: string }) => item.notes)).toEqual([
        'Primeira',
        'Segunda',
      ]);
      expect(response.body.totalHours).toBe(6);
    });

    it('cliente vê as atividades do PRÓPRIO chamado', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.items).toHaveLength(2);
    });

    it('IDOR: cliente recebe 404 nas atividades de chamado alheio', async () => {
      await request(app.getHttpServer())
        .get(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${clientBToken}`)
        .expect(404);
    });

    it('as dicas canEdit/canDelete refletem a autoria', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .expect(200);

      const own = response.body.items.find(
        (item: { notes: string }) => item.notes === 'Segunda',
      );
      const foreign = response.body.items.find(
        (item: { notes: string }) => item.notes === 'Primeira',
      );

      expect(own.canEdit).toBe(true);
      expect(foreign.canEdit).toBe(false);
    });

    it('devolve 404 para chamado inexistente', async () => {
      await request(app.getHttpServer())
        .get(`${API}/tickets/999999/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .expect(404);
    });
  });

  // =========================================================================
  describe('integração com as fases seguintes', () => {
    it('publica ACTIVITY_CREATED com os dados do cliente e do técnico', async () => {
      const received: ActivityCreatedEvent[] = [];
      // `on` devolve o cancelamento da PRÓPRIA assinatura. Usar
      // `removeAllHandlers` aqui derrubaria o handler de e-mail do boot.
      const unsubscribe = events.on(
        ACTIVITY_CREATED,
        (payload) => void received.push(payload),
      );

      try {
        const response = await request(app.getHttpServer())
          .post(`${API}/tickets/${ticketId}/activities`)
          .set('Authorization', `Bearer ${technicianAToken}`)
          .send(validBody())
          .expect(201);

        expect(received).toHaveLength(1);
        expect(received[0]).toMatchObject({
          activityId: response.body.id,
          ticketId,
          ticketTitle: 'Chamado do Cliente A',
          technicianId: technicianAId,
          technicianName: 'Ana Tecnica',
          clientId: clientAId,
          clientEmail: 'ca@example.com',
        });
      } finally {
        unsubscribe();
      }

      // O handler de notificação continua registrado.
      expect(events.handlerCount(ACTIVITY_CREATED)).toBeGreaterThanOrEqual(1);
    });

    it('a notificação de nova atividade agora sai de verdade', async () => {
      mailer.clearCaptured();

      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send(validBody())
        .expect(201);

      expect(mailer.capturedMessages).toHaveLength(1);
      const message = mailer.capturedMessages[0];
      expect(message.recipients).toEqual(['ca@example.com']);
      expect(message.subject).toBe(`[Hope Desk] Nova tarefa no chamado #${ticketId}`);
      expect(message.body).toContain('Inicio: 10/03/2026 08:00');
      expect(message.body).toContain('Tecnico: Ana Tecnica');
    });

    it('as horas criadas aparecem no banco de horas', async () => {
      await prisma.systemParameter.createMany({
        data: [
          { key: 'monthly_hours_allowance', value: '1.00' },
          { key: 'hours_bank_closing_date', value: '2026-01-01' },
        ],
      });

      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send(validBody())
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`${API}/hours-bank?reference=2026-03-15T12:00:00`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .expect(200);

      expect(response.body.totalConsumedHours).toBe(2);
      // Franquia de 1h: excesso de 1h.
      expect(response.body.netAccumulatedHours).toBe(1);
    });

    it('as horas criadas aparecem no relatório de atividades', async () => {
      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send(validBody())
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`${API}/reports/activities?start=2026-03-01&end=2026-03-31`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .expect(200);

      expect(response.body.totalHours).toBe(2);
      expect(response.body.totalsByTechnician).toEqual([
        { technicianName: 'Ana Tecnica', hours: 2 },
      ]);
    });

    it('excluir o chamado remove as atividades em cascata', async () => {
      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticketId}/activities`)
        .set('Authorization', `Bearer ${technicianAToken}`)
        .send(validBody())
        .expect(201);

      await request(app.getHttpServer())
        .delete(`${API}/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(204);

      expect(await prisma.activity.count({ where: { ticketId } })).toBe(0);
    });
  });
});
