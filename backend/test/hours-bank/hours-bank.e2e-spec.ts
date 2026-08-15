import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { PasswordService } from '../../src/auth/password/password.service';
import { parseWallClockInput } from '../../src/common/time/legacy-clock';
import { API, createTestHarness } from '../app-harness';
import { truncateAll } from '../test-database';

/**
 * Fase 06 — banco de horas contra banco real.
 *
 * A aritmética já é verificada pelos 34 casos dourados do Flask
 * (`src/hours-bank/hours-bank.golden.spec.ts`). Aqui verificamos a integração:
 * escopo por perfil, leitura dos parâmetros e recorte no `WHERE`.
 */
describe('Banco de horas (Fase 06)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  const PASSWORD = 'Senha@123';
  let clientAToken: string;
  let clientBToken: string;
  let technicianToken: string;
  let superuserToken: string;

  let clientAId: number;
  let clientBId: number;
  let technicianId: number;
  let moduleId: number;

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
    const [clientA, clientB, technician] = await Promise.all([
      prisma.user.create({
        data: {
          name: 'Cliente A',
          email: 'clientea@example.com',
          passwordHash,
          role: 'client',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Cliente B',
          email: 'clienteb@example.com',
          passwordHash,
          role: 'client',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Tecnico',
          email: 'tecnico@example.com',
          passwordHash,
          role: 'technician',
        },
      }),
    ]);
    await prisma.user.create({
      data: {
        name: 'Super',
        email: 'super@example.com',
        passwordHash,
        role: 'technician',
        isSuperuser: true,
      },
    });

    clientAId = clientA.id;
    clientBId = clientB.id;
    technicianId = technician.id;

    const systemModule = await prisma.systemModule.create({
      data: { name: 'Financeiro' },
    });
    moduleId = systemModule.id;

    await prisma.systemParameter.createMany({
      data: [
        { key: 'monthly_hours_allowance', value: '16.00' },
        { key: 'hours_bank_closing_date', value: '2026-01-01' },
      ],
    });

    [clientAToken, clientBToken, technicianToken, superuserToken] = await Promise.all([
      loginAs('clientea@example.com'),
      loginAs('clienteb@example.com'),
      loginAs('tecnico@example.com'),
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

  async function seedTicketWithActivities(
    clientId: number,
    activities: { startedAt: string; endedAt: string }[],
    ticketCreatedAt?: Date,
  ) {
    const ticket = await prisma.ticket.create({
      data: {
        title: 'Chamado',
        description: 'Descrição',
        clientId,
        systemModuleId: moduleId,
        ...(ticketCreatedAt ? { createdAt: ticketCreatedAt } : {}),
      },
    });

    for (const item of activities) {
      await prisma.activity.create({
        data: {
          ticketId: ticket.id,
          notes: 'Atividade',
          startedAt: parseWallClockInput(item.startedAt),
          endedAt: parseWallClockInput(item.endedAt),
          createdById: technicianId,
        },
      });
    }

    return ticket;
  }

  const REFERENCE = '2026-03-15T12:00:00';

  // =========================================================================
  describe('GET /hours-bank', () => {
    it('devolve zero quando não há atividades', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/hours-bank?reference=${REFERENCE}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.netAccumulatedHours).toBe(0);
      expect(response.body.grossExcessHours).toBe(0);
      expect(response.body.franchiseHours).toBe(16);
      expect(response.body.monthlyBreakdown).toEqual([]);
    });

    it('lê a franquia e a data de fechamento dos parâmetros', async () => {
      await prisma.systemParameter.update({
        where: { key: 'monthly_hours_allowance' },
        data: { value: '8,5' },
      });
      await prisma.systemParameter.update({
        where: { key: 'hours_bank_closing_date' },
        data: { value: '2026-03-01' },
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/hours-bank?reference=${REFERENCE}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.franchiseHours).toBe(8.5);
      expect(response.body.cycleStart).toBe('2026-03-01T00:00:00');
      expect(response.body.cycleEnd).toBe('2026-09-01T00:00:00');
      expect(response.body.cycleStartLabel).toBe('01/03/2026');
      expect(response.body.cycleEndLabel).toBe('01/09/2026');
    });

    it('usa os defaults do legado quando os parâmetros não existem', async () => {
      await prisma.systemParameter.deleteMany({});

      const response = await request(app.getHttpServer())
        .get(`${API}/hours-bank?reference=${REFERENCE}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.franchiseHours).toBe(16);
      // hours_bank_closing_date default é 2000-01-01, então o ciclo avança de
      // seis em seis meses até conter a referência.
      expect(response.body.cycleStart).toBe('2026-01-01T00:00:00');
    });

    it('calcula o excesso mês a mês', async () => {
      await seedTicketWithActivities(clientAId, [
        // Janeiro: 20h → excesso 4.
        { startedAt: '2026-01-05T08:00', endedAt: '2026-01-05T18:00' },
        { startedAt: '2026-01-06T08:00', endedAt: '2026-01-06T18:00' },
        // Fevereiro: 2h → sem excesso.
        { startedAt: '2026-02-05T08:00', endedAt: '2026-02-05T10:00' },
      ]);

      const response = await request(app.getHttpServer())
        .get(`${API}/hours-bank?reference=${REFERENCE}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.grossExcessHours).toBe(4);
      expect(response.body.netAccumulatedHours).toBe(4);
      expect(response.body.monthlyBreakdown).toEqual([
        { year: 2026, month: 1, consumedHours: 20, excessHours: 4 },
        { year: 2026, month: 2, consumedHours: 2, excessHours: 0 },
      ]);
    });

    it('divide atividade que atravessa a virada do mês', async () => {
      await seedTicketWithActivities(clientAId, [
        { startedAt: '2026-01-31T20:00', endedAt: '2026-02-01T04:00' },
      ]);

      const response = await request(app.getHttpServer())
        .get(`${API}/hours-bank?reference=${REFERENCE}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.monthlyBreakdown).toEqual([
        { year: 2026, month: 1, consumedHours: 4, excessHours: 0 },
        { year: 2026, month: 2, consumedHours: 4, excessHours: 0 },
      ]);
      expect(response.body.totalConsumedHours).toBe(8);
    });

    it('desconta as horas pagas do ciclo', async () => {
      await seedTicketWithActivities(clientAId, [
        { startedAt: '2026-03-02T08:00', endedAt: '2026-03-02T18:00' },
        { startedAt: '2026-03-03T08:00', endedAt: '2026-03-03T18:00' },
      ]);
      await prisma.paymentRecord.create({
        data: { paidAt: new Date(Date.UTC(2026, 2, 10)), amount: 500, paidHours: 2 },
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/hours-bank?reference=${REFERENCE}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.grossExcessHours).toBe(4);
      expect(response.body.paidHoursInCycle).toBe(2);
      expect(response.body.netAccumulatedHours).toBe(2);
    });

    it('o saldo nunca fica negativo', async () => {
      await seedTicketWithActivities(clientAId, [
        { startedAt: '2026-03-02T08:00', endedAt: '2026-03-02T18:00' },
        { startedAt: '2026-03-03T08:00', endedAt: '2026-03-03T18:00' },
      ]);
      await prisma.paymentRecord.create({
        data: { paidAt: new Date(Date.UTC(2026, 2, 10)), amount: 0, paidHours: 100 },
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/hours-bank?reference=${REFERENCE}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.netAccumulatedHours).toBe(0);
    });

    it('ignora pagamento fora do ciclo', async () => {
      await prisma.systemParameter.update({
        where: { key: 'hours_bank_closing_date' },
        data: { value: '2026-03-01' },
      });
      await seedTicketWithActivities(clientAId, [
        { startedAt: '2026-03-02T08:00', endedAt: '2026-03-02T18:00' },
        { startedAt: '2026-03-03T08:00', endedAt: '2026-03-03T18:00' },
      ]);
      await prisma.paymentRecord.createMany({
        data: [
          // Antes do ciclo: ignorado.
          { paidAt: new Date(Date.UTC(2026, 1, 20)), amount: 0, paidHours: 5 },
          // Dentro do ciclo.
          { paidAt: new Date(Date.UTC(2026, 2, 10)), amount: 0, paidHours: 1 },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/hours-bank?reference=${REFERENCE}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.paidHoursInCycle).toBe(1);
      expect(response.body.netAccumulatedHours).toBe(3);
    });

    it('soma horas pagas com precisão decimal exata', async () => {
      await seedTicketWithActivities(clientAId, [
        { startedAt: '2026-03-02T08:00', endedAt: '2026-03-02T18:00' },
        { startedAt: '2026-03-03T08:00', endedAt: '2026-03-03T18:00' },
      ]);
      await prisma.paymentRecord.createMany({
        data: [
          { paidAt: new Date(Date.UTC(2026, 2, 5)), amount: 0, paidHours: '0.10' },
          { paidAt: new Date(Date.UTC(2026, 2, 6)), amount: 0, paidHours: '0.20' },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/hours-bank?reference=${REFERENCE}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      // 0.1 + 0.2 em float daria 0.30000000000000004.
      expect(response.body.paidHoursInCycle).toBe(0.3);
    });

    describe('escopo por perfil', () => {
      beforeEach(async () => {
        await seedTicketWithActivities(clientAId, [
          { startedAt: '2026-03-02T08:00', endedAt: '2026-03-02T18:00' },
          { startedAt: '2026-03-03T08:00', endedAt: '2026-03-03T18:00' },
        ]);
        await seedTicketWithActivities(clientBId, [
          { startedAt: '2026-03-04T08:00', endedAt: '2026-03-04T18:00' },
          { startedAt: '2026-03-05T08:00', endedAt: '2026-03-05T18:00' },
        ]);
      });

      it('cliente vê apenas as horas dos próprios chamados', async () => {
        const response = await request(app.getHttpServer())
          .get(`${API}/hours-bank?reference=${REFERENCE}`)
          .set('Authorization', `Bearer ${clientAToken}`)
          .expect(200);

        // 20h só do cliente A.
        expect(response.body.totalConsumedHours).toBe(20);
        expect(response.body.grossExcessHours).toBe(4);
      });

      it('o outro cliente vê apenas as suas', async () => {
        const response = await request(app.getHttpServer())
          .get(`${API}/hours-bank?reference=${REFERENCE}`)
          .set('Authorization', `Bearer ${clientBToken}`)
          .expect(200);

        expect(response.body.totalConsumedHours).toBe(20);
      });

      it('técnico vê as horas de todos os clientes', async () => {
        const response = await request(app.getHttpServer())
          .get(`${API}/hours-bank?reference=${REFERENCE}`)
          .set('Authorization', `Bearer ${technicianToken}`)
          .expect(200);

        // 40h no total.
        expect(response.body.totalConsumedHours).toBe(40);
        expect(response.body.grossExcessHours).toBe(24);
      });

      it('superuser vê as horas de todos os clientes', async () => {
        const response = await request(app.getHttpServer())
          .get(`${API}/hours-bank?reference=${REFERENCE}`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);

        expect(response.body.totalConsumedHours).toBe(40);
      });
    });

    it('atividade é recortada pela referência', async () => {
      await seedTicketWithActivities(clientAId, [
        // Termina depois da referência: só a parte anterior conta.
        { startedAt: '2026-03-15T08:00', endedAt: '2026-03-15T20:00' },
      ]);

      const response = await request(app.getHttpServer())
        .get(`${API}/hours-bank?reference=${REFERENCE}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      // 08:00 → 12:00 = 4h.
      expect(response.body.totalConsumedHours).toBe(4);
    });

    it('atividade totalmente anterior ao ciclo é ignorada', async () => {
      await prisma.systemParameter.update({
        where: { key: 'hours_bank_closing_date' },
        data: { value: '2026-03-01' },
      });
      await seedTicketWithActivities(clientAId, [
        { startedAt: '2026-01-10T08:00', endedAt: '2026-01-10T20:00' },
      ]);

      const response = await request(app.getHttpServer())
        .get(`${API}/hours-bank?reference=${REFERENCE}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.totalConsumedHours).toBe(0);
    });

    it('usa "agora" quando a referência não é informada', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/hours-bank`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      // A referência devolvida é hora de parede de São Paulo, não UTC.
      expect(response.body.reference).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });

    it('recusa referência inválida', async () => {
      await request(app.getHttpServer())
        .get(`${API}/hours-bank?reference=2026-02-30T10:00`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(400);
    });

    it('exige autenticação', async () => {
      await request(app.getHttpServer()).get(`${API}/hours-bank`).expect(401);
    });
  });

  // =========================================================================
  describe('GET /hours-bank/monthly-summary', () => {
    it('soma as horas recortadas no mês', async () => {
      await seedTicketWithActivities(clientAId, [
        { startedAt: '2026-03-02T08:00', endedAt: '2026-03-02T12:00' },
        // Atravessa a virada: só a parte de março conta.
        { startedAt: '2026-02-28T22:00', endedAt: '2026-03-01T02:00' },
      ]);

      const response = await request(app.getHttpServer())
        .get(`${API}/hours-bank/monthly-summary?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      // 4h do dia 2 + 2h da virada = 6h.
      expect(response.body.periodActivityHours).toBe(6);
      expect(response.body.year).toBe(2026);
      expect(response.body.month).toBe(3);
    });

    it('separa horas de atividades ligadas a chamados de outros meses', async () => {
      // Chamado criado em JANEIRO, com atividade em MARÇO.
      await seedTicketWithActivities(
        clientAId,
        [{ startedAt: '2026-03-05T08:00', endedAt: '2026-03-05T12:00' }],
        new Date('2026-01-10T12:00:00.000Z'),
      );
      // Chamado criado em MARÇO, com atividade em MARÇO.
      await seedTicketWithActivities(
        clientAId,
        [{ startedAt: '2026-03-06T08:00', endedAt: '2026-03-06T10:00' }],
        new Date('2026-03-06T12:00:00.000Z'),
      );

      const response = await request(app.getHttpServer())
        .get(`${API}/hours-bank/monthly-summary?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.periodActivityHours).toBe(6);
      // Só as 4h do chamado de janeiro.
      expect(response.body.externalTicketActivityHours).toBe(4);
    });

    it('horas pagas do mês usam limite superior EXCLUSIVO', async () => {
      await prisma.paymentRecord.createMany({
        data: [
          { paidAt: new Date(Date.UTC(2026, 2, 1)), amount: 0, paidHours: 1 },
          { paidAt: new Date(Date.UTC(2026, 2, 31)), amount: 0, paidHours: 2 },
          // 1º de abril: fora do mês de março.
          { paidAt: new Date(Date.UTC(2026, 3, 1)), amount: 0, paidHours: 4 },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/hours-bank/monthly-summary?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.paidHoursInMonth).toBe(3);
    });

    it('respeita o escopo do cliente', async () => {
      await seedTicketWithActivities(clientAId, [
        { startedAt: '2026-03-02T08:00', endedAt: '2026-03-02T12:00' },
      ]);
      await seedTicketWithActivities(clientBId, [
        { startedAt: '2026-03-03T08:00', endedAt: '2026-03-03T18:00' },
      ]);

      const asClient = await request(app.getHttpServer())
        .get(`${API}/hours-bank/monthly-summary?year=2026&month=3`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);
      expect(asClient.body.periodActivityHours).toBe(4);

      const asTechnician = await request(app.getHttpServer())
        .get(`${API}/hours-bank/monthly-summary?year=2026&month=3`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);
      expect(asTechnician.body.periodActivityHours).toBe(14);
    });

    it('recusa mês fora de 1..12', async () => {
      await request(app.getHttpServer())
        .get(`${API}/hours-bank/monthly-summary?year=2026&month=13`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(400);
    });
  });
});
