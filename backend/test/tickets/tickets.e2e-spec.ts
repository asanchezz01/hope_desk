import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { PasswordService } from '../../src/auth/password/password.service';
import {
  DomainEventMap,
  DomainEventName,
  TICKET_CREATED,
  TICKET_STATUS_CHANGED,
  TicketCreatedEvent,
  TicketStatusChangedEvent,
} from '../../src/common/events/domain-events';
import { DomainEventsService } from '../../src/common/events/domain-events.service';
import { API, createTestHarness } from '../app-harness';
import { truncateAll } from '../test-database';

/**
 * Fase 04 — domínio de chamados.
 *
 * Ênfase em IDOR: cliente não pode ver, editar, excluir nem abrir chamado em
 * nome de outro cliente.
 */
describe('Chamados (Fase 04)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let events: DomainEventsService;

  const PASSWORD = 'Senha@123';

  let clientAToken: string;
  let clientBToken: string;
  let technicianToken: string;
  let superuserToken: string;

  let clientAId: number;
  let clientBId: number;
  let technicianId: number;
  let superuserId: number;
  let activeModuleId: number;
  let inactiveModuleId: number;

  beforeAll(async () => {
    const harness = await createTestHarness();
    app = harness.app;
    prisma = harness.prisma;
    close = harness.close;
    events = app.get(DomainEventsService);
  });

  afterAll(async () => {
    await close();
  });

  /**
   * Assinaturas feitas pelos testes, canceladas individualmente no `afterEach`.
   *
   * Não use `removeAllHandlers`: ele derrubaria também os handlers de e-mail
   * registrados no boot pela aplicação.
   */
  const subscriptions: (() => void)[] = [];

  function subscribe<Name extends DomainEventName>(
    event: Name,
    handler: (payload: DomainEventMap[Name]) => void | Promise<void>,
  ): void {
    subscriptions.push(events.on(event, handler));
  }

  afterEach(() => {
    while (subscriptions.length > 0) {
      subscriptions.pop()!();
    }
  });

  beforeEach(async () => {
    await truncateAll(prisma);

    const passwordHash = await new PasswordService().hash(PASSWORD);

    const [clientA, clientB, technician, superuser] = await Promise.all([
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
      prisma.user.create({
        data: {
          name: 'Super',
          email: 'super@example.com',
          passwordHash,
          role: 'technician',
          isSuperuser: true,
        },
      }),
    ]);

    clientAId = clientA.id;
    clientBId = clientB.id;
    technicianId = technician.id;
    superuserId = superuser.id;

    const [activeModule, inactiveModule] = await Promise.all([
      prisma.systemModule.create({ data: { name: 'Financeiro', isActive: true } }),
      prisma.systemModule.create({ data: { name: 'Legado', isActive: false } }),
    ]);
    activeModuleId = activeModule.id;
    inactiveModuleId = inactiveModule.id;

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

  /** Cria chamado direto no banco, com created_at controlável. */
  async function seedTicket(overrides: {
    clientId: number;
    technicianId?: number | null;
    status?: string;
    title?: string;
    createdAt?: Date;
    systemModuleId?: number | null;
  }) {
    return prisma.ticket.create({
      data: {
        title: overrides.title ?? 'Chamado de teste',
        description: 'Descrição do chamado',
        status: overrides.status ?? 'aberto',
        clientId: overrides.clientId,
        technicianId: overrides.technicianId ?? null,
        systemModuleId:
          overrides.systemModuleId === undefined
            ? activeModuleId
            : overrides.systemModuleId,
        ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
      },
    });
  }

  const validCreateBody = () => ({
    title: 'Impressora não funciona',
    description: 'A impressora do setor financeiro parou.',
    systemModuleId: activeModuleId,
  });

  // =========================================================================
  describe('POST /tickets — criação', () => {
    it('cliente abre chamado para si', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send(validCreateBody())
        .expect(201);

      expect(response.body.client.id).toBe(clientAId);
      expect(response.body.status).toBe('aberto');
      expect(response.body.statusLabel).toBe('Em aberto');
      expect(response.body.technician).toBeNull();
      expect(response.body.systemModule.id).toBe(activeModuleId);
      expect(response.body.activityCount).toBe(0);
    });

    it('IDOR: clientId enviado por cliente é IGNORADO, não aceito', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ ...validCreateBody(), clientId: clientBId })
        .expect(201);

      // O chamado pertence a quem abriu, não ao cliente informado.
      expect(response.body.client.id).toBe(clientAId);

      const stored = await prisma.ticket.findUniqueOrThrow({
        where: { id: response.body.id },
      });
      expect(stored.clientId).toBe(clientAId);
    });

    it('técnico abre chamado para um cliente', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ ...validCreateBody(), clientId: clientBId })
        .expect(201);

      expect(response.body.client.id).toBe(clientBId);
    });

    it('superuser abre chamado para um cliente', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ ...validCreateBody(), clientId: clientAId })
        .expect(201);

      expect(response.body.client.id).toBe(clientAId);
    });

    it('técnico sem informar cliente recebe 400', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send(validCreateBody())
        .expect(400);

      expect(response.body.message).toMatch(/selecione um cliente/i);
    });

    it('recusa cliente inexistente', async () => {
      await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ ...validCreateBody(), clientId: 999999 })
        .expect(400);
    });

    it('recusa técnico informado como cliente (papel errado)', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ ...validCreateBody(), clientId: technicianId })
        .expect(400);

      expect(response.body.message).toMatch(/cliente inválido/i);
    });

    it('atribui técnico válido', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ ...validCreateBody(), technicianId })
        .expect(201);

      expect(response.body.technician.id).toBe(technicianId);
    });

    it('recusa cliente informado como técnico (papel errado)', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ ...validCreateBody(), technicianId: clientBId })
        .expect(400);

      expect(response.body.message).toMatch(/técnico inválido/i);
    });

    it('exige módulo ATIVO na criação', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ ...validCreateBody(), systemModuleId: inactiveModuleId })
        .expect(400);

      expect(response.body.message).toMatch(/módulo inválido/i);
    });

    it('recusa módulo inexistente', async () => {
      await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ ...validCreateBody(), systemModuleId: 999999 })
        .expect(400);
    });

    it('exige módulo (não é opcional)', async () => {
      const body = validCreateBody() as Record<string, unknown>;
      delete body.systemModuleId;

      await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send(body)
        .expect(400);
    });

    it.each([
      ['título vazio', { title: '' }],
      ['título só com espaços', { title: '    ' }],
      ['descrição vazia', { description: '' }],
      ['descrição só com espaços', { description: '   ' }],
    ])('recusa %s', async (_label, override) => {
      await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ ...validCreateBody(), ...override })
        .expect(400);
    });

    it('normaliza espaços em título e descrição', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({
          ...validCreateBody(),
          title: '  Com espaços  ',
          description: '  Descrição  ',
        })
        .expect(201);

      expect(response.body.title).toBe('Com espaços');
      expect(response.body.description).toBe('Descrição');
    });

    it('recusa campos não declarados', async () => {
      await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ ...validCreateBody(), status: 'fechado' })
        .expect(400);
    });

    it('exige autenticação', async () => {
      await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .send(validCreateBody())
        .expect(401);
    });

    it('grava created_at em UTC', async () => {
      const before = Date.now();
      const response = await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send(validCreateBody())
        .expect(201);

      const createdAt = new Date(response.body.createdAt).getTime();
      // Se o default seguisse o fuso da sessão, haveria desvio de ~3 horas.
      expect(Math.abs(createdAt - before)).toBeLessThan(60_000);
    });
  });

  // =========================================================================
  describe('eventos de domínio (sem e-mail nesta fase)', () => {
    it('publica ticket.created com os dados do cliente', async () => {
      const received: TicketCreatedEvent[] = [];
      subscribe(TICKET_CREATED, (payload) => void received.push(payload));

      const response = await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send(validCreateBody())
        .expect(201);

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        ticketId: response.body.id,
        clientId: clientAId,
        clientEmail: 'clientea@example.com',
        clientName: 'Cliente A',
        technicianId: null,
      });
    });

    it('inclui o técnico designado no evento (define destinatários na Fase 07)', async () => {
      const received: TicketCreatedEvent[] = [];
      subscribe(TICKET_CREATED, (payload) => void received.push(payload));

      await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ ...validCreateBody(), technicianId })
        .expect(201);

      expect(received[0].technicianId).toBe(technicianId);
    });

    it('publica ticket.status-changed com status anterior e novo', async () => {
      const received: TicketStatusChangedEvent[] = [];
      subscribe(TICKET_STATUS_CHANGED, (payload) => void received.push(payload));

      const ticket = await seedTicket({ clientId: clientAId, status: 'aberto' });

      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ status: 'em_andamento' })
        .expect(200);

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        ticketId: ticket.id,
        previousStatus: 'aberto',
        newStatus: 'em_andamento',
        clientEmail: 'clientea@example.com',
      });
    });

    it('NÃO publica evento quando o status não muda, como no legado', async () => {
      const received: TicketStatusChangedEvent[] = [];
      subscribe(TICKET_STATUS_CHANGED, (payload) => void received.push(payload));

      const ticket = await seedTicket({ clientId: clientAId, status: 'aberto' });

      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ status: 'aberto' })
        .expect(200);

      expect(received).toHaveLength(0);
    });

    it('falha de handler não derruba a operação de negócio', async () => {
      subscribe(TICKET_CREATED, () => {
        throw new Error('SMTP indisponível');
      });

      const response = await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send(validCreateBody())
        .expect(201);

      // O chamado foi persistido mesmo com o handler falhando.
      expect(await prisma.ticket.count({ where: { id: response.body.id } })).toBe(1);
    });
  });

  // =========================================================================
  describe('GET /tickets/:id — isolamento por cliente (IDOR)', () => {
    it('cliente vê o próprio chamado', async () => {
      const ticket = await seedTicket({ clientId: clientAId });

      const response = await request(app.getHttpServer())
        .get(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.id).toBe(ticket.id);
    });

    it('cliente recebe 404 no chamado de outro cliente', async () => {
      const ticket = await seedTicket({ clientId: clientBId });

      const response = await request(app.getHttpServer())
        .get(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(404);

      // 404 e não 403: não revela que o chamado existe.
      expect(response.body.message).toMatch(/não encontrado/i);
    });

    it('o isolamento é simétrico: cada cliente vê só o seu', async () => {
      const ticketA = await seedTicket({ clientId: clientAId, title: 'Do A' });
      const ticketB = await seedTicket({ clientId: clientBId, title: 'Do B' });

      // A vê o seu, não vê o de B.
      await request(app.getHttpServer())
        .get(`${API}/tickets/${ticketA.id}`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .get(`${API}/tickets/${ticketB.id}`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(404);

      // B vê o seu, não vê o de A.
      await request(app.getHttpServer())
        .get(`${API}/tickets/${ticketB.id}`)
        .set('Authorization', `Bearer ${clientBToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .get(`${API}/tickets/${ticketA.id}`)
        .set('Authorization', `Bearer ${clientBToken}`)
        .expect(404);
    });

    it('a resposta de chamado alheio é indistinguível de inexistente', async () => {
      const ticket = await seedTicket({ clientId: clientBId });

      const foreign = await request(app.getHttpServer())
        .get(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(404);

      const missing = await request(app.getHttpServer())
        .get(`${API}/tickets/999999`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(404);

      expect(foreign.body.message).toBe(missing.body.message);
    });

    it('técnico vê chamado de qualquer cliente', async () => {
      const ticket = await seedTicket({ clientId: clientBId });

      await request(app.getHttpServer())
        .get(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);
    });

    it('superuser vê chamado de qualquer cliente', async () => {
      const ticket = await seedTicket({ clientId: clientBId });

      await request(app.getHttpServer())
        .get(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(200);
    });

    it('exige autenticação', async () => {
      const ticket = await seedTicket({ clientId: clientAId });
      await request(app.getHttpServer()).get(`${API}/tickets/${ticket.id}`).expect(401);
    });
  });

  // =========================================================================
  describe('GET /tickets — listagem e filtros', () => {
    /** Julho de 2026, para casar com o filtro de período dos testes. */
    const JULY = new Date('2026-07-10T12:00:00.000Z');
    const JUNE = new Date('2026-06-10T12:00:00.000Z');

    it('cliente vê apenas os próprios chamados', async () => {
      await seedTicket({ clientId: clientAId, createdAt: JULY, title: 'Do A' });
      await seedTicket({ clientId: clientBId, createdAt: JULY, title: 'Do B' });

      const response = await request(app.getHttpServer())
        .get(`${API}/tickets?year=2026&month=7`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.items[0].title).toBe('Do A');
    });

    it('IDOR: o isolamento vale também com paginação', async () => {
      for (let index = 0; index < 5; index += 1) {
        await seedTicket({
          clientId: clientBId,
          createdAt: JULY,
          title: `Do B ${index}`,
        });
      }
      await seedTicket({ clientId: clientAId, createdAt: JULY, title: 'Do A' });

      const response = await request(app.getHttpServer())
        .get(`${API}/tickets?year=2026&month=7&page=1&pageSize=100`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.total).toBe(1);
      expect(
        response.body.items.every(
          (ticket: { client: { id: number } }) => ticket.client.id === clientAId,
        ),
      ).toBe(true);
    });

    it('IDOR: busca por ID de chamado alheio não devolve nada', async () => {
      const foreign = await seedTicket({ clientId: clientBId, createdAt: JULY });

      const response = await request(app.getHttpServer())
        .get(`${API}/tickets?search=${foreign.id}&allPeriods=true`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.total).toBe(0);
    });

    it('técnico vê chamados de todos os clientes', async () => {
      await seedTicket({ clientId: clientAId, createdAt: JULY });
      await seedTicket({ clientId: clientBId, createdAt: JULY });

      const response = await request(app.getHttpServer())
        .get(`${API}/tickets?year=2026&month=7`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.total).toBe(2);
    });

    it('filtra por período de criação', async () => {
      await seedTicket({ clientId: clientAId, createdAt: JULY, title: 'Julho' });
      await seedTicket({ clientId: clientAId, createdAt: JUNE, title: 'Junho' });

      const july = await request(app.getHttpServer())
        .get(`${API}/tickets?year=2026&month=7`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);
      expect(july.body.total).toBe(1);
      expect(july.body.items[0].title).toBe('Julho');

      const june = await request(app.getHttpServer())
        .get(`${API}/tickets?year=2026&month=6`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);
      expect(june.body.total).toBe(1);
      expect(june.body.items[0].title).toBe('Junho');
    });

    it('inclui o primeiro e o último instante do mês', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        title: 'Primeiro',
      });
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-07-31T23:59:59.000Z'),
        title: 'Último',
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/tickets?year=2026&month=7&status=all`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.total).toBe(2);
    });

    it('dezembro não vaza para janeiro do ano seguinte', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-12-31T23:00:00.000Z'),
        title: 'Dezembro',
      });
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2027-01-01T01:00:00.000Z'),
        title: 'Janeiro',
      });

      const december = await request(app.getHttpServer())
        .get(`${API}/tickets?year=2026&month=12`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);
      expect(december.body.items.map((t: { title: string }) => t.title)).toEqual([
        'Dezembro',
      ]);

      const january = await request(app.getHttpServer())
        .get(`${API}/tickets?year=2027&month=1`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);
      expect(january.body.items.map((t: { title: string }) => t.title)).toEqual([
        'Janeiro',
      ]);
    });

    it('allPeriods ignora o filtro de período', async () => {
      await seedTicket({ clientId: clientAId, createdAt: JULY });
      await seedTicket({ clientId: clientAId, createdAt: JUNE });
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/tickets?allPeriods=true`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.total).toBe(3);
      expect(response.body.appliedFilters.year).toBeNull();
    });

    describe('filtro de status', () => {
      beforeEach(async () => {
        for (const status of ['aberto', 'em_andamento', 'resolvido', 'fechado']) {
          await seedTicket({
            clientId: clientAId,
            createdAt: JULY,
            status,
            title: status,
          });
        }
      });

      it('nao_concluidos é o default e exclui resolvido e fechado', async () => {
        const response = await request(app.getHttpServer())
          .get(`${API}/tickets?year=2026&month=7`)
          .set('Authorization', `Bearer ${clientAToken}`)
          .expect(200);

        expect(response.body.appliedFilters.status).toBe('nao_concluidos');
        expect(
          response.body.items.map((t: { status: string }) => t.status).sort(),
        ).toEqual(['aberto', 'em_andamento']);
      });

      it('all devolve os quatro status', async () => {
        const response = await request(app.getHttpServer())
          .get(`${API}/tickets?year=2026&month=7&status=all`)
          .set('Authorization', `Bearer ${clientAToken}`)
          .expect(200);

        expect(response.body.total).toBe(4);
      });

      it.each(['aberto', 'em_andamento', 'resolvido', 'fechado'])(
        'filtra por status %s',
        async (status) => {
          const response = await request(app.getHttpServer())
            .get(`${API}/tickets?year=2026&month=7&status=${status}`)
            .set('Authorization', `Bearer ${clientAToken}`)
            .expect(200);

          expect(response.body.total).toBe(1);
          expect(response.body.items[0].status).toBe(status);
        },
      );

      it('status desconhecido cai para nao_concluidos, como no legado', async () => {
        const response = await request(app.getHttpServer())
          .get(`${API}/tickets?year=2026&month=7&status=inventado`)
          .set('Authorization', `Bearer ${clientAToken}`)
          .expect(200);

        expect(response.body.appliedFilters.status).toBe('nao_concluidos');
        expect(response.body.total).toBe(2);
      });
    });

    it('busca por título, sem diferenciar maiúsculas', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: JULY,
        title: 'Impressora quebrada',
      });
      await seedTicket({ clientId: clientAId, createdAt: JULY, title: 'Rede lenta' });

      const response = await request(app.getHttpServer())
        .get(`${API}/tickets?year=2026&month=7&search=IMPRESSORA`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.items[0].title).toBe('Impressora quebrada');
    });

    it('busca por ID exato', async () => {
      const ticket = await seedTicket({ clientId: clientAId, createdAt: JULY });
      await seedTicket({ clientId: clientAId, createdAt: JULY });

      const response = await request(app.getHttpServer())
        .get(`${API}/tickets?year=2026&month=7&search=${ticket.id}`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.items[0].id).toBe(ticket.id);
    });

    it('ordena por created_at desc, como o legado', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-07-01T10:00:00.000Z'),
        title: 'Antigo',
      });
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2026-07-20T10:00:00.000Z'),
        title: 'Recente',
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/tickets?year=2026&month=7`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.items.map((t: { title: string }) => t.title)).toEqual([
        'Recente',
        'Antigo',
      ]);
    });

    it('pagina corretamente', async () => {
      for (let index = 0; index < 5; index += 1) {
        await seedTicket({ clientId: clientAId, createdAt: JULY });
      }

      const response = await request(app.getHttpServer())
        .get(`${API}/tickets?year=2026&month=7&page=2&pageSize=2`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.items).toHaveLength(2);
      expect(response.body.page).toBe(2);
      expect(response.body.totalPages).toBe(3);
      expect(response.body.total).toBe(5);
    });

    it('inclui a contagem de atividades', async () => {
      const ticket = await seedTicket({ clientId: clientAId, createdAt: JULY });
      await prisma.activity.createMany({
        data: [
          {
            ticketId: ticket.id,
            notes: 'A',
            startedAt: new Date('2026-07-10T08:00:00.000Z'),
            endedAt: new Date('2026-07-10T09:00:00.000Z'),
            createdById: technicianId,
          },
          {
            ticketId: ticket.id,
            notes: 'B',
            startedAt: new Date('2026-07-10T10:00:00.000Z'),
            endedAt: new Date('2026-07-10T11:00:00.000Z'),
            createdById: technicianId,
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/tickets?year=2026&month=7`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.items[0].activityCount).toBe(2);
    });

    it('GET /tickets/available-years respeita o escopo do cliente', async () => {
      await seedTicket({
        clientId: clientAId,
        createdAt: new Date('2024-05-01T12:00:00.000Z'),
      });
      await seedTicket({
        clientId: clientBId,
        createdAt: new Date('2021-05-01T12:00:00.000Z'),
      });

      const response = await request(app.getHttpServer())
        .get(`${API}/tickets/available-years`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body).toContain(2024);
      // Ano de chamado alheio não aparece.
      expect(response.body).not.toContain(2021);
      // O ano corrente é sempre incluído, como no legado.
      expect(response.body).toContain(new Date().getFullYear());
    });
  });

  // =========================================================================
  describe('PATCH /tickets/:id — edição', () => {
    const validUpdateBody = () => ({
      title: 'Título atualizado',
      description: 'Descrição atualizada',
      status: 'em_andamento',
      clientId: clientAId,
      systemModuleId: activeModuleId,
    });

    it('cliente NÃO edita chamado, nem o próprio', async () => {
      const ticket = await seedTicket({ clientId: clientAId });

      await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send(validUpdateBody())
        .expect(403);

      const unchanged = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
      });
      expect(unchanged.title).toBe('Chamado de teste');
    });

    it('técnico edita', async () => {
      const ticket = await seedTicket({ clientId: clientAId });

      const response = await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send(validUpdateBody())
        .expect(200);

      expect(response.body.title).toBe('Título atualizado');
      expect(response.body.status).toBe('em_andamento');
    });

    it('superuser edita', async () => {
      const ticket = await seedTicket({ clientId: clientAId });

      await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send(validUpdateBody())
        .expect(200);
    });

    it('aceita módulo INATIVO na edição — diferença deliberada da criação', async () => {
      const ticket = await seedTicket({ clientId: clientAId });

      const response = await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ ...validUpdateBody(), systemModuleId: inactiveModuleId })
        .expect(200);

      expect(response.body.systemModule.id).toBe(inactiveModuleId);
      expect(response.body.systemModule.isActive).toBe(false);
    });

    it('transfere o chamado para outro cliente', async () => {
      const ticket = await seedTicket({ clientId: clientAId });

      const response = await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ ...validUpdateBody(), clientId: clientBId })
        .expect(200);

      expect(response.body.client.id).toBe(clientBId);
    });

    it('atribui e desatribui técnico', async () => {
      const ticket = await seedTicket({ clientId: clientAId });

      const assigned = await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ ...validUpdateBody(), technicianId })
        .expect(200);
      expect(assigned.body.technician.id).toBe(technicianId);

      const unassigned = await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ ...validUpdateBody(), technicianId: null })
        .expect(200);
      expect(unassigned.body.technician).toBeNull();
    });

    it('recusa status inválido', async () => {
      const ticket = await seedTicket({ clientId: clientAId });

      await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ ...validUpdateBody(), status: 'cancelado' })
        .expect(400);
    });

    it('exige cliente na edição', async () => {
      const ticket = await seedTicket({ clientId: clientAId });
      const body = validUpdateBody() as Record<string, unknown>;
      delete body.clientId;

      await request(app.getHttpServer())
        .patch(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send(body)
        .expect(400);
    });

    it('devolve 404 para chamado inexistente', async () => {
      await request(app.getHttpServer())
        .patch(`${API}/tickets/999999`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send(validUpdateBody())
        .expect(404);
    });
  });

  // =========================================================================
  describe('POST /tickets/:id/status — mudança de status', () => {
    it('técnico muda o status', async () => {
      const ticket = await seedTicket({ clientId: clientAId, status: 'aberto' });

      const response = await request(app.getHttpServer())
        .post(`${API}/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ status: 'resolvido' })
        .expect(200);

      expect(response.body.status).toBe('resolvido');
      // resolvido é apresentado como "Concluído" no legado.
      expect(response.body.statusLabel).toBe('Concluído');
    });

    it('cliente NÃO muda o status do próprio chamado', async () => {
      const ticket = await seedTicket({ clientId: clientAId, status: 'aberto' });

      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ status: 'fechado' })
        .expect(403);

      const unchanged = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
      });
      expect(unchanged.status).toBe('aberto');
    });

    it.each(['aberto', 'em_andamento', 'resolvido', 'fechado'])(
      'aceita o status %s',
      async (status) => {
        const ticket = await seedTicket({ clientId: clientAId, status: 'aberto' });

        await request(app.getHttpServer())
          .post(`${API}/tickets/${ticket.id}/status`)
          .set('Authorization', `Bearer ${technicianToken}`)
          .send({ status })
          .expect(200);
      },
    );

    it('recusa status fora dos quatro do legado', async () => {
      const ticket = await seedTicket({ clientId: clientAId });

      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ status: 'cancelado' })
        .expect(400);
    });

    it('devolve 404 para chamado inexistente', async () => {
      await request(app.getHttpServer())
        .post(`${API}/tickets/999999/status`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ status: 'fechado' })
        .expect(404);
    });
  });

  // =========================================================================
  describe('DELETE /tickets/:id — janela de exclusão por mês', () => {
    /** Chamado do mês corrente, em hora de São Paulo. */
    function currentMonthDate(): Date {
      return new Date();
    }

    /** Chamado de dois meses atrás, garantidamente fora da janela. */
    function oldDate(): Date {
      const date = new Date();
      date.setUTCMonth(date.getUTCMonth() - 2);
      return date;
    }

    it('cliente nunca exclui', async () => {
      const ticket = await seedTicket({
        clientId: clientAId,
        createdAt: currentMonthDate(),
      });

      await request(app.getHttpServer())
        .delete(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(403);

      expect(await prisma.ticket.count({ where: { id: ticket.id } })).toBe(1);
    });

    it('técnico exclui chamado do mês corrente', async () => {
      const ticket = await seedTicket({
        clientId: clientAId,
        createdAt: currentMonthDate(),
      });

      await request(app.getHttpServer())
        .delete(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(204);

      expect(await prisma.ticket.count({ where: { id: ticket.id } })).toBe(0);
    });

    it('técnico NÃO exclui chamado histórico', async () => {
      const ticket = await seedTicket({ clientId: clientAId, createdAt: oldDate() });

      const response = await request(app.getHttpServer())
        .delete(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(403);

      expect(response.body.message).toMatch(/mês corrente/i);
      expect(await prisma.ticket.count({ where: { id: ticket.id } })).toBe(1);
    });

    it('superuser exclui chamado histórico', async () => {
      const ticket = await seedTicket({ clientId: clientAId, createdAt: oldDate() });

      await request(app.getHttpServer())
        .delete(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(204);

      expect(await prisma.ticket.count({ where: { id: ticket.id } })).toBe(0);
    });

    it('excluir chamado remove as atividades em cascata', async () => {
      const ticket = await seedTicket({
        clientId: clientAId,
        createdAt: currentMonthDate(),
      });
      await prisma.activity.create({
        data: {
          ticketId: ticket.id,
          notes: 'Atividade',
          startedAt: new Date('2026-07-10T08:00:00.000Z'),
          endedAt: new Date('2026-07-10T10:00:00.000Z'),
          createdById: technicianId,
        },
      });

      await request(app.getHttpServer())
        .delete(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(204);

      expect(await prisma.activity.count({ where: { ticketId: ticket.id } })).toBe(0);
    });

    it('devolve 404 para chamado inexistente', async () => {
      await request(app.getHttpServer())
        .delete(`${API}/tickets/999999`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(404);
    });

    it('cliente recebe 403 mesmo para chamado inexistente (checa papel antes)', async () => {
      // O legado também aplica o role_required antes de buscar o registro.
      await request(app.getHttpServer())
        .delete(`${API}/tickets/999999`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(403);
    });
  });

  // =========================================================================
  describe('chamados legados sem módulo', () => {
    it('chamado com system_module_id nulo continua legível', async () => {
      const ticket = await seedTicket({ clientId: clientAId, systemModuleId: null });

      const response = await request(app.getHttpServer())
        .get(`${API}/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(response.body.systemModule).toBeNull();
    });
  });

  // =========================================================================
  describe('mustChangePassword bloqueia o domínio de chamados', () => {
    it('usuário com troca pendente recebe 403', async () => {
      await prisma.user.update({
        where: { id: clientAId },
        data: { mustChangePassword: true },
      });
      const token = await loginAs('clientea@example.com');

      await request(app.getHttpServer())
        .get(`${API}/tickets`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(403);
    });
  });

  // =========================================================================
  describe('superuser com papel client (caso de borda do legado)', () => {
    it('vê apenas os próprios chamados, porque a checagem é por papel', async () => {
      await prisma.user.update({
        where: { id: superuserId },
        data: { role: 'client' },
      });
      const token = await loginAs('super@example.com');

      const foreign = await seedTicket({ clientId: clientAId });

      // `canViewTicket` testa `role == "client"` sem exceção para superuser,
      // exatamente como `ticket_detail` do legado.
      await request(app.getHttpServer())
        .get(`${API}/tickets/${foreign.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
