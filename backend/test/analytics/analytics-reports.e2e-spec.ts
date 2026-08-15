import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { PasswordService } from '../../src/auth/password/password.service';
import { parseWallClockInput } from '../../src/common/time/legacy-clock';
import { API, createTestHarness } from '../app-harness';
import { truncateAll } from '../test-database';

/**
 * Fase 07 — analytics e relatórios.
 */
describe('Analytics e relatórios (Fase 07)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  const PASSWORD = 'Senha@123';
  let clientAToken: string;
  let clientBToken: string;
  let technicianToken: string;

  let clientAId: number;
  let clientBId: number;
  let technicianId: number;
  let otherTechnicianId: number;
  let moduleAId: number;
  let moduleBId: number;

  beforeAll(async () => {
    const harness = await createTestHarness();
    app = harness.app;
    prisma = harness.prisma;
    close = harness.close;
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);

    const passwordHash = await new PasswordService().hash(PASSWORD);
    const [clientA, clientB, technician, otherTechnician] = await Promise.all([
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
    ]);

    clientAId = clientA.id;
    clientBId = clientB.id;
    technicianId = technician.id;
    otherTechnicianId = otherTechnician.id;

    const [moduleA, moduleB] = await Promise.all([
      prisma.systemModule.create({ data: { name: 'Financeiro' } }),
      prisma.systemModule.create({ data: { name: 'Estoque' } }),
    ]);
    moduleAId = moduleA.id;
    moduleBId = moduleB.id;

    await prisma.systemParameter.createMany({
      data: [
        { key: 'company_name', value: 'Hope Tecnologia' },
        { key: 'company_address', value: 'Rua Exemplo, 100' },
        { key: 'company_logo', value: '' },
        { key: 'monthly_hours_allowance', value: '16.00' },
        { key: 'hours_bank_closing_date', value: '2026-01-01' },
      ],
    });

    [clientAToken, clientBToken, technicianToken] = await Promise.all([
      loginAs('ca@example.com'),
      loginAs('cb@example.com'),
      loginAs('ana@example.com'),
    ]);
  });

  async function loginAs(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(200);
    return response.body.accessToken;
  }

  async function seedTicket(options: {
    clientId: number;
    createdAt: Date;
    status?: string;
    title?: string;
    technicianId?: number | null;
    systemModuleId?: number | null;
    activities?: {
      startedAt: string;
      endedAt: string;
      createdById?: number;
      notes?: string;
    }[];
  }) {
    const ticket = await prisma.ticket.create({
      data: {
        title: options.title ?? 'Chamado',
        description: 'Descrição do chamado',
        status: options.status ?? 'aberto',
        clientId: options.clientId,
        technicianId: options.technicianId ?? null,
        systemModuleId:
          options.systemModuleId === undefined ? moduleAId : options.systemModuleId,
        createdAt: options.createdAt,
      },
    });

    for (const activity of options.activities ?? []) {
      await prisma.activity.create({
        data: {
          ticketId: ticket.id,
          notes: activity.notes ?? 'Atividade realizada',
          startedAt: parseWallClockInput(activity.startedAt),
          endedAt: parseWallClockInput(activity.endedAt),
          createdById: activity.createdById ?? technicianId,
        },
      });
    }

    return ticket;
  }

  // =========================================================================
  describe('GET /analytics — visões de período', () => {
    it('visão mensal usa eixo diário com um bucket por dia do mês', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=2`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.bucketMode).toBe('day');
      // Fevereiro de 2026 tem 28 dias.
      expect(response.body.buckets).toHaveLength(28);
      expect(response.body.buckets[0]).toEqual({ key: '1', label: '1' });
      expect(response.body.periodLabel).toBe('Visão de Fevereiro de 2026');
    });

    it('fevereiro de ano bissexto tem 29 buckets', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2028&month=2`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.buckets).toHaveLength(29);
    });

    it('visão anual usa eixo mensal com 12 buckets', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.bucketMode).toBe('month');
      expect(response.body.buckets).toHaveLength(12);
      expect(response.body.buckets[0]).toEqual({ key: '2026-01', label: 'Jan' });
      expect(response.body.periodLabel).toBe('Visão do ano de 2026');
      expect(response.body.selectedMonth).toBeNull();
    });

    it('visão de todo o período rotula os meses com o ano abreviado', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-05-10T12:00:00.000Z'),
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?allPeriods=true`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.bucketMode).toBe('month');
      expect(response.body.selectedYear).toBeNull();
      expect(response.body.periodLabel).toBe('Visão de todo o período');
      expect(response.body.buckets[0].label).toMatch(/^\w{3}\/\d{2}$/);
    });

    it('sem parâmetros devolve o mês corrente', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.bucketMode).toBe('day');
      expect(response.body.selectedMonth).not.toBeNull();
      expect(response.body.selectedYear).not.toBeNull();
    });

    it('devolve os anos disponíveis incluindo o ano corrente', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2024-05-10T12:00:00.000Z'),
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.availableYears).toContain(2024);
      expect(response.body.availableYears).toContain(new Date().getFullYear());
    });
  });

  // =========================================================================
  describe('GET /analytics — KPIs', () => {
    beforeEach(async () => {
      // Março de 2026: 3 chamados, 2 concluídos.
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-03-05T10:00:00.000Z'),
        status: 'aberto',
        title: 'Aberto A',
        technicianId,
        activities: [{ startedAt: '2026-03-05T14:00', endedAt: '2026-03-05T18:00' }],
      });
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-03-06T10:00:00.000Z'),
        status: 'resolvido',
        title: 'Resolvido A',
        systemModuleId: moduleBId,
        activities: [{ startedAt: '2026-03-06T14:00', endedAt: '2026-03-06T16:00' }],
      });
      await seedTicket({
        clientId: clientBId,
        createdAt: new Date('2026-03-07T10:00:00.000Z'),
        status: 'fechado',
        title: 'Fechado B',
        activities: [
          {
            startedAt: '2026-03-07T09:00',
            endedAt: '2026-03-07T12:00',
            createdById: otherTechnicianId,
          },
        ],
      });
    });

    it('conta chamados totais, concluídos e abertos', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.kpis.totalTickets).toBe(3);
      expect(response.body.kpis.concludedTickets).toBe(2);
      expect(response.body.kpis.openTickets).toBe(1);
    });

    it('soma as horas do período', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      // 4 + 2 + 3 = 9h.
      expect(response.body.kpis.totalHours).toBe(9);
      expect(response.body.kpis.averageHoursPerTicket).toBe(3);
    });

    it('calcula o tempo até a primeira atividade', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.kpis.ticketsWithActivity).toBe(3);
      expect(response.body.kpis.averageFirstResponseHours).toBeGreaterThan(0);

      const aberto = response.body.tickets.find(
        (row: { title: string }) => row.title === 'Aberto A',
      );
      // created_at 10:00 UTC, atividade 14:00 de parede: o legado subtrai
      // direto, resultando em 4h (a distorção de fuso é preservada).
      expect(aberto.responseHours).toBe(4);
    });

    it('devolve null na primeira resposta quando não há atividade', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-03-08T10:00:00.000Z'),
        title: 'Sem atividade',
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      const row = response.body.tickets.find(
        (item: { title: string }) => item.title === 'Sem atividade',
      );
      expect(row.responseHours).toBeNull();
    });

    it('idade em dias é null para chamados concluídos', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      const concluded = response.body.tickets.find(
        (row: { title: string }) => row.title === 'Resolvido A',
      );
      const open = response.body.tickets.find(
        (row: { title: string }) => row.title === 'Aberto A',
      );

      expect(concluded.ageDays).toBeNull();
      expect(open.ageDays).toBeGreaterThanOrEqual(0);
    });

    it('agrega por status com os rótulos e cores do legado', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      const byStatus = response.body.byStatus as {
        key: string;
        label: string;
        count: number;
      }[];
      expect(byStatus.find((item) => item.key === 'resolvido')?.label).toBe(
        'Concluído',
      );
      expect(response.body.statusMeta.resolvido.color).toBe('#1f9d55');
      expect(response.body.statusMeta.aberto.color).toBe('#d92120');
    });

    it('agrega por módulo, tratando chamado sem módulo', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-03-09T10:00:00.000Z'),
        systemModuleId: null,
        activities: [{ startedAt: '2026-03-09T08:00', endedAt: '2026-03-09T09:00' }],
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      const byModule = response.body.byModule as { key: string; hours: number }[];
      expect(byModule.map((item) => item.key)).toContain('Sem módulo');
      expect(byModule.map((item) => item.key)).toContain('Financeiro');
      expect(byModule.map((item) => item.key)).toContain('Estoque');
    });

    it('agrega por técnico: horas de quem registrou, contagem de quem é designado', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      const byTechnician = response.body.byTechnician as {
        key: string;
        count: number;
        hours: number;
      }[];

      const ana = byTechnician.find((item) => item.key === 'Ana Tecnica')!;
      const bruno = byTechnician.find((item) => item.key === 'Bruno Tecnico')!;

      // Ana registrou 4 + 2 = 6h e está designada em 1 chamado.
      expect(ana.hours).toBe(6);
      expect(ana.count).toBe(1);
      // Bruno registrou 3h e não está designado em nenhum.
      expect(bruno.hours).toBe(3);
      expect(bruno.count).toBe(0);
    });

    it('agrega por cliente', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      const byClient = response.body.byClient as { key: string; count: number }[];
      expect(byClient.find((item) => item.key === 'Cliente A')?.count).toBe(2);
      expect(byClient.find((item) => item.key === 'Cliente B')?.count).toBe(1);
    });

    it('distribui horas e chamados pelos buckets do eixo', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      // Dia 5: 4h e 1 chamado aberto.
      expect(response.body.hoursByBucket['5']).toBe(4);
      expect(response.body.ticketsByBucket['5']).toBe(1);
      // Dia sem movimento fica zerado, não ausente.
      expect(response.body.hoursByBucket['20']).toBe(0);
    });
  });

  // =========================================================================
  describe('GET /analytics — backlog', () => {
    it('conta abertos e em andamento de TODO o histórico, não só do período', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2020-01-10T12:00:00.000Z'),
        status: 'aberto',
      });
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-03-10T12:00:00.000Z'),
        status: 'em_andamento',
      });
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-03-11T12:00:00.000Z'),
        status: 'resolvido',
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      // O chamado de 2020 conta no backlog, mesmo fora do período selecionado.
      expect(response.body.backlog.total).toBe(2);
      expect(response.body.backlog.oldestDays).toBeGreaterThan(1000);
    });

    it('backlog zerado quando não há chamados em aberto', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-03-10T12:00:00.000Z'),
        status: 'fechado',
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.backlog.total).toBe(0);
      expect(response.body.backlog.oldestDays).toBe(0);
      expect(response.body.backlog.oldestTicketId).toBeNull();
    });
  });

  // =========================================================================
  describe('GET /analytics — tendência de 12 meses', () => {
    it('devolve sempre 12 pontos encerrando no período', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.trend).toHaveLength(12);
      // Último ponto = mês selecionado.
      expect(response.body.trend[11]).toMatchObject({ year: 2026, month: 3 });
      // Primeiro ponto = 11 meses antes.
      expect(response.body.trend[0]).toMatchObject({ year: 2025, month: 4 });
      expect(response.body.trend[0].label).toBe('04/25');
    });

    it('conta chamados e horas nos meses corretos', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-01-10T12:00:00.000Z'),
        activities: [{ startedAt: '2026-01-10T08:00', endedAt: '2026-01-10T12:00' }],
      });
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-03-10T12:00:00.000Z'),
        activities: [{ startedAt: '2026-03-10T08:00', endedAt: '2026-03-10T10:00' }],
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      const trend = response.body.trend as {
        year: number;
        month: number;
        tickets: number;
        hours: number;
      }[];
      const january = trend.find((p) => p.year === 2026 && p.month === 1)!;
      const march = trend.find((p) => p.year === 2026 && p.month === 3)!;

      expect(january).toMatchObject({ tickets: 1, hours: 4 });
      expect(march).toMatchObject({ tickets: 1, hours: 2 });
    });

    it('fatia atividade que atravessa a virada do mês na tendência', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-01-31T12:00:00.000Z'),
        activities: [{ startedAt: '2026-01-31T20:00', endedAt: '2026-02-01T04:00' }],
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      const trend = response.body.trend as { month: number; hours: number }[];
      expect(trend.find((p) => p.month === 1)?.hours).toBe(4);
      expect(trend.find((p) => p.month === 2)?.hours).toBe(4);
    });
  });

  // =========================================================================
  describe('GET /analytics — isolamento por cliente', () => {
    beforeEach(async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-03-05T10:00:00.000Z'),
        title: 'Do A',
        activities: [{ startedAt: '2026-03-05T08:00', endedAt: '2026-03-05T12:00' }],
      });
      await seedTicket({
        clientId: clientBId,
        createdAt: new Date('2026-03-06T10:00:00.000Z'),
        title: 'Do B',
        activities: [{ startedAt: '2026-03-06T08:00', endedAt: '2026-03-06T18:00' }],
      });
    });

    it('cliente vê apenas os próprios chamados e horas', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.kpis.totalTickets).toBe(1);
      expect(response.body.kpis.totalHours).toBe(4);
      expect(response.body.tickets.map((row: { title: string }) => row.title)).toEqual([
        'Do A',
      ]);
    });

    it('o outro cliente vê apenas os seus', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${clientBToken}`)
        .expect(200);

      expect(response.body.kpis.totalTickets).toBe(1);
      expect(response.body.kpis.totalHours).toBe(10);
    });

    it('cliente não vê o backlog nem a tendência de outros', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.backlog.total).toBe(1);
      const trend = response.body.trend as { month: number; hours: number }[];
      expect(trend.find((p) => p.month === 3)?.hours).toBe(4);
    });

    it('técnico vê os dados de todos', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/analytics?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.kpis.totalTickets).toBe(2);
      expect(response.body.kpis.totalHours).toBe(14);
    });

    it('exige autenticação', async () => {
      await request(app.getHttpServer()).get(`${API}/analytics`).expect(401);
    });
  });

  // =========================================================================
  describe('GET /reports/activities', () => {
    beforeEach(async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-03-01T10:00:00.000Z'),
        title: 'Chamado com duas atividades',
        technicianId,
        activities: [
          {
            startedAt: '2026-03-05T08:00',
            endedAt: '2026-03-05T12:00',
            notes: 'Primeira atividade',
          },
          {
            startedAt: '2026-03-06T14:00',
            endedAt: '2026-03-06T16:30',
            notes: 'Segunda atividade',
            createdById: otherTechnicianId,
          },
        ],
      });
    });

    it('agrupa atividades por chamado com totais', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/reports/activities?start=2026-03-01&end=2026-03-31`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.tickets).toHaveLength(1);
      expect(response.body.tickets[0].activities).toHaveLength(2);
      // 4h + 2.5h = 6.5h.
      expect(response.body.tickets[0].totalHours).toBe(6.5);
      expect(response.body.totalHours).toBe(6.5);
    });

    it('totaliza por técnico em ordem alfabética', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/reports/activities?start=2026-03-01&end=2026-03-31`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.totalsByTechnician).toEqual([
        { technicianName: 'Ana Tecnica', hours: 4 },
        { technicianName: 'Bruno Tecnico', hours: 2.5 },
      ]);
    });

    it('recorta proporcionalmente atividade que cruza a fronteira do período', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-03-30T10:00:00.000Z'),
        title: 'Atravessa o fim do período',
        activities: [{ startedAt: '2026-03-31T20:00', endedAt: '2026-04-01T04:00' }],
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/reports/activities?start=2026-03-01&end=2026-03-31`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      const crossing = response.body.tickets.find(
        (row: { title: string }) => row.title === 'Atravessa o fim do período',
      );
      // Só as 4h de 31/03 20:00 até 01/04 00:00.
      expect(crossing.totalHours).toBe(4);
      expect(crossing.activities[0].hours).toBe(4);
      // As datas originais são preservadas ao lado das recortadas.
      expect(crossing.activities[0].startedLabel).toBe('31/03/2026 20:00');
      expect(crossing.activities[0].endedLabel).toBe('01/04/2026 04:00');
    });

    it('a data final é inclusiva (o dia inteiro entra)', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-03-31T10:00:00.000Z'),
        title: 'No último dia',
        activities: [{ startedAt: '2026-03-31T22:00', endedAt: '2026-03-31T23:30' }],
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/reports/activities?start=2026-03-31&end=2026-03-31`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      const row = response.body.tickets.find(
        (item: { title: string }) => item.title === 'No último dia',
      );
      expect(row.totalHours).toBe(1.5);
    });

    it('inclui o cabeçalho da empresa', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/reports/activities?start=2026-03-01&end=2026-03-31`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.company).toEqual({
        companyName: 'Hope Tecnologia',
        companyAddress: 'Rua Exemplo, 100',
        companyLogo: '',
      });
    });

    it('rotula o período com o último dia inclusivo', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/reports/activities?start=2026-03-01&end=2026-03-31`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.periodStartLabel).toBe('01/03/2026');
      expect(response.body.periodEndLabel).toBe('31/03/2026');
    });

    it('cliente recebe somente os próprios dados', async () => {
      await seedTicket({
        clientId: clientBId,
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
        title: 'Do outro cliente',
        activities: [{ startedAt: '2026-03-10T08:00', endedAt: '2026-03-10T18:00' }],
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/reports/activities?start=2026-03-01&end=2026-03-31`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.tickets).toHaveLength(1);
      expect(response.body.totalHours).toBe(6.5);
    });

    it('recusa período invertido', async () => {
      await request(app.getHttpServer())
        .get(`${API}/reports/activities?start=2026-03-31&end=2026-03-01`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(400);
    });

    it('recusa data em formato inválido', async () => {
      await request(app.getHttpServer())
        .get(`${API}/reports/activities?start=31/03/2026`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(400);
    });

    it('devolve relatório vazio quando não há atividades', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/reports/activities?start=2030-01-01&end=2030-01-31`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.tickets).toEqual([]);
      expect(response.body.totalHours).toBe(0);
    });
  });

  // =========================================================================
  describe('GET /reports/services', () => {
    it('lista uma linha por atividade, ordenada pelo fim decrescente', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-03-01T10:00:00.000Z'),
        activities: [
          {
            startedAt: '2026-03-05T08:00',
            endedAt: '2026-03-05T10:00',
            notes: 'Antiga',
          },
          {
            startedAt: '2026-03-20T08:00',
            endedAt: '2026-03-20T11:00',
            notes: 'Recente',
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/reports/services?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.rows.map((row: { service: string }) => row.service)).toEqual(
        ['Recente', 'Antiga'],
      );
      expect(response.body.totalHours).toBe(5);
      expect(response.body.periodLabel).toBe('03/2026');
    });

    it('usa o rótulo de status do legado', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-03-01T10:00:00.000Z'),
        status: 'resolvido',
        activities: [{ startedAt: '2026-03-05T08:00', endedAt: '2026-03-05T10:00' }],
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/reports/services?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.rows[0].status).toBe('Concluído');
    });

    it('recorta a atividade que atravessa o fim do mês', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-03-31T10:00:00.000Z'),
        activities: [{ startedAt: '2026-03-31T22:00', endedAt: '2026-04-01T02:00' }],
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/reports/services?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.rows[0].hours).toBe(2);
      // O legado exibe o fim recortado no último instante do período.
      expect(response.body.rows[0].lastActivityLabel).toBe('31/03/2026 23:59');
    });

    it('cliente recebe somente os próprios dados', async () => {
      await seedTicket({
        clientId: clientBId,
        createdAt: new Date('2026-03-01T10:00:00.000Z'),
        activities: [{ startedAt: '2026-03-05T08:00', endedAt: '2026-03-05T18:00' }],
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/reports/services?year=2026&month=3`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.rows).toEqual([]);
    });
  });

  // =========================================================================
  describe('download de PDF', () => {
    beforeEach(async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-03-01T10:00:00.000Z'),
        title: 'Chamado do relatório',
        technicianId,
        activities: [
          { startedAt: '2026-03-05T08:00', endedAt: '2026-03-05T12:00' },
          {
            startedAt: '2026-03-06T14:00',
            endedAt: '2026-03-06T16:30',
            createdById: otherTechnicianId,
          },
        ],
      });
    });

    it('gera PDF do relatório de atividades', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/reports/activities.pdf?start=2026-03-01&end=2026-03-31`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .buffer()
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.pdf');

      const body = response.body as Buffer;
      // Assinatura de arquivo PDF.
      expect(body.subarray(0, 5).toString()).toBe('%PDF-');
      expect(body.length).toBeGreaterThan(1000);
    });

    it('gera PDF do demonstrativo de serviços', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/reports/services.pdf?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .buffer()
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      const body = response.body as Buffer;
      expect(body.subarray(0, 5).toString()).toBe('%PDF-');
      expect(body.length).toBeGreaterThan(1000);
    });

    it('gera PDF válido mesmo sem dados no período', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/reports/activities.pdf?start=2030-01-01&end=2030-01-31`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .buffer()
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect((response.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('logo com URL remota não quebra a geração (ignorado por segurança)', async () => {
      await prisma.systemParameter.update({
        where: { key: 'company_logo' },
        data: { value: 'https://exemplo.invalido/logo.png' },
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/reports/activities.pdf?start=2026-03-01&end=2026-03-31`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .buffer()
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect((response.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('logo com caminho inexistente não quebra a geração', async () => {
      await prisma.systemParameter.update({
        where: { key: 'company_logo' },
        data: { value: 'static/nao-existe.png' },
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/reports/services.pdf?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .buffer()
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect((response.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('PDF exige autenticação', async () => {
      await request(app.getHttpServer())
        .get(`${API}/reports/activities.pdf`)
        .expect(401);
    });
  });
});
