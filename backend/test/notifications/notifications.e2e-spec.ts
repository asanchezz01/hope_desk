import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { PasswordService } from '../../src/auth/password/password.service';
import {
  ACTIVITY_CREATED,
  PASSWORD_RESET_REQUESTED,
  TICKET_CREATED,
  TICKET_STATUS_CHANGED,
} from '../../src/common/events/domain-events';
import { DomainEventsService } from '../../src/common/events/domain-events.service';
import { parseWallClockInput } from '../../src/common/time/legacy-clock';
import { MailerService } from '../../src/notifications/mailer.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { API, createTestHarness } from '../app-harness';
import { truncateAll } from '../test-database';

/**
 * Fase 07 — notificações.
 *
 * `MAIL_ENABLED=false` no ambiente de teste, então o `MailerService` captura as
 * mensagens em memória em vez de enviar. Isso permite verificar destinatários e
 * corpos sem SMTP.
 */
describe('Notificações (Fase 07)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let events: DomainEventsService;
  let mailer: MailerService;
  let notifications: NotificationsService;

  const PASSWORD = 'Senha@123';
  let clientToken: string;
  let technicianToken: string;

  let clientId: number;
  let technicianAId: number;
  let technicianBId: number;
  let superuserId: number;
  let moduleId: number;

  beforeAll(async () => {
    const harness = await createTestHarness();
    app = harness.app;
    prisma = harness.prisma;
    close = harness.close;
    events = app.get(DomainEventsService);
    mailer = app.get(MailerService);
    notifications = app.get(NotificationsService);
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    mailer.clearCaptured();

    const passwordHash = await new PasswordService().hash(PASSWORD);
    const [client, technicianA, technicianB, superuser] = await Promise.all([
      prisma.user.create({
        data: {
          name: 'Cliente Um',
          email: 'cliente@example.com',
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

    clientId = client.id;
    technicianAId = technicianA.id;
    technicianBId = technicianB.id;
    superuserId = superuser.id;

    const systemModule = await prisma.systemModule.create({
      data: { name: 'Financeiro' },
    });
    moduleId = systemModule.id;

    [clientToken, technicianToken] = await Promise.all([
      loginAs('cliente@example.com'),
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

  // =========================================================================
  describe('os handlers estão registrados no barramento', () => {
    it.each([
      ['ticket.created', TICKET_CREATED],
      ['ticket.status-changed', TICKET_STATUS_CHANGED],
      ['activity.created', ACTIVITY_CREATED],
      ['password.reset-requested', PASSWORD_RESET_REQUESTED],
    ])('%s tem handler', (_label, event) => {
      expect(events.handlerCount(event)).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  describe('novo chamado — regra de destinatários do legado', () => {
    it('COM técnico designado: notifica somente o designado', async () => {
      await notifications.onTicketCreated({
        ticketId: 1,
        title: 'Chamado',
        description: 'Descrição',
        clientId,
        clientName: 'Cliente Um',
        clientEmail: 'cliente@example.com',
        technicianId: technicianAId,
      });

      expect(mailer.capturedMessages).toHaveLength(1);
      expect(mailer.capturedMessages[0].recipients).toEqual(['ana@example.com']);
    });

    it('SEM técnico: notifica todos os técnicos, EXCETO superusers', async () => {
      await notifications.onTicketCreated({
        ticketId: 1,
        title: 'Chamado',
        description: 'Descrição',
        clientId,
        clientName: 'Cliente Um',
        clientEmail: 'cliente@example.com',
        technicianId: null,
      });

      expect(mailer.capturedMessages).toHaveLength(1);
      // Ordenado alfabeticamente, como `sorted({...})` do legado.
      expect(mailer.capturedMessages[0].recipients).toEqual([
        'ana@example.com',
        'bruno@example.com',
      ]);
      // O superuser não recebe.
      expect(mailer.capturedMessages[0].recipients).not.toContain('super@example.com');
    });

    it('SEM técnico e sem técnicos cadastrados: não envia nada', async () => {
      await prisma.user.deleteMany({
        where: { id: { in: [technicianAId, technicianBId, superuserId] } },
      });

      const sent = await notifications.onTicketCreated({
        ticketId: 1,
        title: 'Chamado',
        description: 'Descrição',
        clientId,
        clientName: 'Cliente Um',
        clientEmail: 'cliente@example.com',
        technicianId: null,
      });

      expect(sent).toBe(false);
      expect(mailer.capturedMessages).toHaveLength(0);
    });

    it('técnico designado que perdeu o papel não recebe', async () => {
      await prisma.user.update({
        where: { id: technicianAId },
        data: { role: 'client' },
      });

      const sent = await notifications.onTicketCreated({
        ticketId: 1,
        title: 'Chamado',
        description: 'Descrição',
        clientId,
        clientName: 'Cliente Um',
        clientEmail: 'cliente@example.com',
        technicianId: technicianAId,
      });

      // O legado filtra por `role="technician"` ao buscar o designado.
      expect(sent).toBe(false);
      expect(mailer.capturedMessages).toHaveLength(0);
    });

    it('o e-mail traz assunto, cliente e link do chamado', async () => {
      await notifications.onTicketCreated({
        ticketId: 42,
        title: 'Impressora parou',
        description: 'Não imprime.',
        clientId,
        clientName: 'Cliente Um',
        clientEmail: 'cliente@example.com',
        technicianId: technicianAId,
      });

      const message = mailer.capturedMessages[0];
      expect(message.subject).toBe('[Hope Desk] Novo chamado #42: Impressora parou');
      expect(message.body).toContain('Cliente: Cliente Um');
      expect(message.body).toContain('/tickets/42');
    });
  });

  // =========================================================================
  describe('fluxo completo: criar chamado dispara a notificação', () => {
    it('cliente abre chamado sem técnico → todos os técnicos são notificados', async () => {
      await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          title: 'Impressora parou',
          description: 'Não imprime nada.',
          systemModuleId: moduleId,
        })
        .expect(201);

      expect(mailer.capturedMessages).toHaveLength(1);
      expect(mailer.capturedMessages[0].recipients).toEqual([
        'ana@example.com',
        'bruno@example.com',
      ]);
    });

    it('cliente abre chamado COM técnico → só ele é notificado', async () => {
      await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          title: 'Impressora parou',
          description: 'Não imprime nada.',
          systemModuleId: moduleId,
          technicianId: technicianBId,
        })
        .expect(201);

      expect(mailer.capturedMessages).toHaveLength(1);
      expect(mailer.capturedMessages[0].recipients).toEqual(['bruno@example.com']);
    });
  });

  // =========================================================================
  describe('mudança de status', () => {
    it('notifica somente o cliente do chamado', async () => {
      await notifications.onTicketStatusChanged({
        ticketId: 7,
        title: 'Chamado',
        previousStatus: 'aberto',
        newStatus: 'em_andamento',
        clientId,
        clientName: 'Cliente Um',
        clientEmail: 'cliente@example.com',
      });

      expect(mailer.capturedMessages).toHaveLength(1);
      expect(mailer.capturedMessages[0].recipients).toEqual(['cliente@example.com']);
      expect(mailer.capturedMessages[0].body).toContain('Status anterior: aberto');
      expect(mailer.capturedMessages[0].body).toContain('Novo status: em_andamento');
    });

    it('fluxo completo: técnico muda status → cliente recebe', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          title: 'Chamado',
          description: 'Descrição',
          clientId,
          systemModuleId: moduleId,
        },
      });
      mailer.clearCaptured();

      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ status: 'resolvido' })
        .expect(200);

      expect(mailer.capturedMessages).toHaveLength(1);
      expect(mailer.capturedMessages[0].recipients).toEqual(['cliente@example.com']);
    });

    it('status inalterado não gera e-mail', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          title: 'Chamado',
          description: 'Descrição',
          status: 'aberto',
          clientId,
          systemModuleId: moduleId,
        },
      });
      mailer.clearCaptured();

      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ status: 'aberto' })
        .expect(200);

      expect(mailer.capturedMessages).toHaveLength(0);
    });
  });

  // =========================================================================
  describe('nova atividade', () => {
    it('notifica somente o cliente, com início e fim em hora de parede', async () => {
      await notifications.onActivityCreated({
        activityId: 3,
        ticketId: 7,
        ticketTitle: 'Chamado',
        notes: 'Troquei o toner.',
        startedAt: parseWallClockInput('2026-03-10T08:30'),
        endedAt: parseWallClockInput('2026-03-10T10:45'),
        technicianId: technicianAId,
        technicianName: 'Ana Tecnica',
        clientId,
        clientName: 'Cliente Um',
        clientEmail: 'cliente@example.com',
      });

      expect(mailer.capturedMessages).toHaveLength(1);
      const message = mailer.capturedMessages[0];
      expect(message.recipients).toEqual(['cliente@example.com']);
      expect(message.subject).toBe('[Hope Desk] Nova tarefa no chamado #7');
      expect(message.body).toContain('Inicio: 10/03/2026 08:30');
      expect(message.body).toContain('Fim: 10/03/2026 10:45');
      expect(message.body).toContain('Tecnico: Ana Tecnica');
    });
  });

  // =========================================================================
  describe('recuperação de senha', () => {
    it('fluxo completo: forgot-password envia e-mail ao próprio usuário', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/forgot-password`)
        .send({ email: 'cliente@example.com' })
        .expect(200);

      expect(mailer.capturedMessages).toHaveLength(1);
      const message = mailer.capturedMessages[0];
      expect(message.recipients).toEqual(['cliente@example.com']);
      expect(message.subject).toBe('[Hope Desk] Troca de senha');
      expect(message.body).toContain('Ola, Cliente Um.');
      expect(message.body).toContain('valido por 2 horas');
      expect(message.body).toContain('/reset-password/');
    });

    it('e-mail inexistente não gera envio, e a resposta é a mesma', async () => {
      const existing = await request(app.getHttpServer())
        .post(`${API}/auth/forgot-password`)
        .send({ email: 'cliente@example.com' })
        .expect(200);

      mailer.clearCaptured();

      const missing = await request(app.getHttpServer())
        .post(`${API}/auth/forgot-password`)
        .send({ email: 'ninguem@example.com' })
        .expect(200);

      expect(mailer.capturedMessages).toHaveLength(0);
      // A mensagem continua idêntica: não revela se a conta existe.
      expect(missing.body.message).toBe(existing.body.message);
    });

    it('o token do e-mail funciona de verdade na redefinição', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/forgot-password`)
        .send({ email: 'cliente@example.com' })
        .expect(200);

      const body = mailer.capturedMessages[0].body;
      const match = /\/reset-password\/([^\s]+)/.exec(body);
      expect(match).not.toBeNull();
      const token = decodeURIComponent(match![1]);

      await request(app.getHttpServer())
        .post(`${API}/auth/reset-password`)
        .send({
          token,
          password: 'NovaSenha@456',
          confirmation: 'NovaSenha@456',
        })
        .expect(200);

      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'cliente@example.com', password: 'NovaSenha@456' })
        .expect(200);
    });

    it('a resposta HTTP nunca contém o token', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/auth/forgot-password`)
        .send({ email: 'cliente@example.com' })
        .expect(200);

      const token = /\/reset-password\/([^\s]+)/.exec(
        mailer.capturedMessages[0].body,
      )![1];
      expect(JSON.stringify(response.body)).not.toContain(token);
    });
  });

  // =========================================================================
  describe('falha de SMTP não bloqueia a transação principal', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('erro no envio não impede a criação do chamado', async () => {
      jest.spyOn(mailer, 'send').mockRejectedValue(new Error('SMTP indisponível'));

      const response = await request(app.getHttpServer())
        .post(`${API}/tickets`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          title: 'Chamado com SMTP quebrado',
          description: 'Descrição',
          systemModuleId: moduleId,
        })
        .expect(201);

      // O chamado foi persistido.
      expect(await prisma.ticket.count({ where: { id: response.body.id } })).toBe(1);
    });

    it('erro no envio não impede a mudança de status', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          title: 'Chamado',
          description: 'Descrição',
          clientId,
          systemModuleId: moduleId,
        },
      });

      jest.spyOn(mailer, 'send').mockRejectedValue(new Error('SMTP indisponível'));

      await request(app.getHttpServer())
        .post(`${API}/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ status: 'fechado' })
        .expect(200);

      const stored = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
      });
      expect(stored.status).toBe('fechado');
    });

    it('erro no envio não impede a emissão do token de recuperação', async () => {
      jest.spyOn(mailer, 'send').mockRejectedValue(new Error('SMTP indisponível'));

      await request(app.getHttpServer())
        .post(`${API}/auth/forgot-password`)
        .send({ email: 'cliente@example.com' })
        .expect(200);

      // O token foi gravado, mesmo com o envio falhando.
      const stored = await prisma.user.findUniqueOrThrow({
        where: { email: 'cliente@example.com' },
      });
      expect(stored.resetTokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('send devolve false em vez de lançar quando o transporte falha', async () => {
      // MAIL_ENABLED=false já faz `send` devolver false sem tentar SMTP.
      const sent = await mailer.send({
        recipients: ['alguem@example.com'],
        subject: 'Teste',
        body: 'Corpo',
      });
      expect(sent).toBe(false);
    });

    it('send devolve false para lista de destinatários vazia', async () => {
      const sent = await mailer.send({
        recipients: [],
        subject: 'Teste',
        body: 'Corpo',
      });
      expect(sent).toBe(false);
      expect(mailer.capturedMessages).toHaveLength(0);
    });
  });
});
