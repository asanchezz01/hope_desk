/**
 * Endurecimento (Fase 11): headers, correlation ID e trilha de auditoria.
 *
 * O rate limiting fica em `rate-limit.e2e-spec.ts`, que precisa subir a
 * aplicação com limites próprios.
 */
import { INestApplication, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { PasswordService } from '../../src/auth/password/password.service';
import { CORRELATION_ID_HEADER } from '../../src/common/observability/request-context';
import { API, createTestHarness } from '../app-harness';
import { truncateAll } from '../test-database';

describe('Endurecimento (Fase 11)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  const PASSWORD = 'Senha@123';
  let superuserId: number;
  let superuserToken: string;

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
    const superuser = await prisma.user.create({
      data: {
        name: 'Super',
        email: 'super@example.com',
        passwordHash,
        role: 'technician',
        isSuperuser: true,
      },
    });
    superuserId = superuser.id;

    const login = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: 'super@example.com', password: PASSWORD })
      .expect(200);
    superuserToken = login.body.accessToken;
  });

  // -------------------------------------------------------------------------
  describe('headers de segurança', () => {
    it('aplica os headers do helmet nas respostas', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/health`)
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-dns-prefetch-control']).toBe('off');
    });

    it('não anuncia a tecnologia do servidor', async () => {
      // `X-Powered-By: Express` entrega gratuitamente qual pilha atacar.
      const response = await request(app.getHttpServer())
        .get(`${API}/health`)
        .expect(200);
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('permite que o PDF seja lido de outra origem', async () => {
      // O padrão do helmet é `same-origin`, que faria o navegador bloquear o
      // download do relatório servido para o frontend em outra porta.
      const response = await request(app.getHttpServer())
        .get(`${API}/health`)
        .expect(200);
      expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });
  });

  // -------------------------------------------------------------------------
  describe('correlation ID', () => {
    it('devolve um ID mesmo sem o cliente pedir', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/health`)
        .expect(200);
      expect(response.headers[CORRELATION_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('propaga o ID enviado pelo cliente', async () => {
      const provided = 'req-integracao-0001';
      const response = await request(app.getHttpServer())
        .get(`${API}/health`)
        .set(CORRELATION_ID_HEADER, provided)
        .expect(200);

      expect(response.headers[CORRELATION_ID_HEADER]).toBe(provided);
    });

    it('descarta um ID malformado em vez de ecoá-lo', async () => {
      // Ecoar entrada não validada num header permitiria forjar linhas de log.
      const response = await request(app.getHttpServer())
        .get(`${API}/health`)
        .set(CORRELATION_ID_HEADER, 'curto')
        .expect(200);

      expect(response.headers[CORRELATION_ID_HEADER]).not.toBe('curto');
      expect(response.headers[CORRELATION_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('acompanha também as respostas de erro', async () => {
      // 401 e 403 são justamente as que mais interessa rastrear — por isso o
      // correlation ID é middleware, e não interceptor.
      const response = await request(app.getHttpServer())
        .get(`${API}/tickets`)
        .expect(401);
      expect(response.headers[CORRELATION_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('registra uma linha por requisição concluída, com status e duração', async () => {
      // A linha é o que sustenta "desempenho básico": sem status e duração por
      // rota, não há como responder qual endpoint está lento nem quantos 4xx a
      // API devolveu — e nenhum dos dois aparece no log de aplicação comum.
      const logged: string[] = [];
      const spy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation((message: unknown) => {
          logged.push(String(message));
        });

      try {
        await request(app.getHttpServer()).get(`${API}/health`).expect(200);
        // Recusada num guard, antes de qualquer controller: precisa aparecer
        // igual, senão o log perderia justamente as respostas de erro.
        await request(app.getHttpServer()).get(`${API}/tickets`).expect(401);
      } finally {
        spy.mockRestore();
      }

      expect(logged).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^GET \/api\/v1\/health 200 \d+(\.\d+)?ms$/),
          expect.stringMatching(/^GET \/api\/v1\/tickets 401 \d+(\.\d+)?ms$/),
        ]),
      );
    });

    it('gera IDs distintos para requisições distintas', async () => {
      const [first, second] = await Promise.all([
        request(app.getHttpServer()).get(`${API}/health`),
        request(app.getHttpServer()).get(`${API}/health`),
      ]);
      expect(first.headers[CORRELATION_ID_HEADER]).not.toBe(
        second.headers[CORRELATION_ID_HEADER],
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('trilha de auditoria', () => {
    it('registra login bem-sucedido com o ator', async () => {
      const entries = await prisma.auditLog.findMany({
        where: { action: 'auth.login_succeeded' },
      });

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        actorId: superuserId,
        actorEmail: 'super@example.com',
        entityType: 'user',
      });
      expect(entries[0].correlationId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('registra login falho sem revelar nada na resposta', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'super@example.com', password: 'errada' })
        .expect(401);

      // A resposta continua idêntica à de e-mail inexistente.
      expect(response.body.message).toBe('E-mail ou senha inválidos.');

      const entries = await prisma.auditLog.findMany({
        where: { action: 'auth.login_failed' },
      });
      expect(entries).toHaveLength(1);
      expect(entries[0].actorId).toBeNull();
      expect(entries[0].actorEmail).toBe('super@example.com');
      expect(entries[0].metadata).toMatchObject({ reason: 'wrong_password' });
    });

    it('distingue e-mail inexistente de senha errada NA TRILHA, não na resposta', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'ninguem@example.com', password: 'x' })
        .expect(401);

      const entry = await prisma.auditLog.findFirst({
        where: { action: 'auth.login_failed' },
        orderBy: { id: 'desc' },
      });
      expect(entry?.metadata).toMatchObject({ reason: 'unknown_email' });
    });

    it('registra o correlation ID enviado pelo cliente', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .set(CORRELATION_ID_HEADER, 'req-rastreio-0001')
        .send({ email: 'super@example.com', password: 'errada' })
        .expect(401);

      const entry = await prisma.auditLog.findFirst({
        where: { action: 'auth.login_failed' },
        orderBy: { id: 'desc' },
      });
      expect(entry?.correlationId).toBe('req-rastreio-0001');
    });

    it('registra criação e exclusão de pagamento com os valores gravados', async () => {
      const created = await request(app.getHttpServer())
        .post(`${API}/payments`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ paidAt: '2026-07-15', amount: '1500,75', paidHours: '10,5' })
        .expect(201);

      const createdEntry = await prisma.auditLog.findFirst({
        where: { action: 'payment.created' },
      });
      expect(createdEntry).toMatchObject({
        actorId: superuserId,
        entityType: 'payment',
      });
      expect(createdEntry?.metadata).toMatchObject({ amount: '1500.75' });

      await request(app.getHttpServer())
        .delete(`${API}/payments/${created.body.id}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(204);

      const deletedEntry = await prisma.auditLog.findFirst({
        where: { action: 'payment.deleted' },
      });
      expect(deletedEntry?.metadata).toMatchObject({ amount: '1500.75' });
    });

    it('registra mudança de privilégio como ação própria', async () => {
      const target = await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({
          name: 'Novo Tecnico',
          email: 'novo@example.com',
          password: 'Senha@123',
          role: 'client',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`${API}/users/${target.body.id}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ role: 'technician', isSuperuser: true })
        .expect(200);

      const roleChange = await prisma.auditLog.findFirst({
        where: { action: 'user.role_changed' },
      });
      const superuserChange = await prisma.auditLog.findFirst({
        where: { action: 'user.superuser_changed' },
      });

      expect(roleChange?.metadata).toMatchObject({ from: 'client', to: 'technician' });
      expect(superuserChange?.metadata).toMatchObject({ from: false, to: true });
    });

    it('sobrevive à exclusão do usuário que praticou a ação', async () => {
      // `onDelete: SetNull`: a trilha não pode sumir justamente quando o ator é
      // removido — que é o caso em que ela mais importa.
      const target = await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({
          name: 'Efemero',
          email: 'efemero@example.com',
          password: 'Senha@123',
          role: 'client',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'efemero@example.com', password: 'Senha@123' })
        .expect(200);

      const before = await prisma.auditLog.findFirst({
        where: { action: 'auth.login_succeeded', actorId: target.body.id },
      });
      expect(before).not.toBeNull();

      await request(app.getHttpServer())
        .delete(`${API}/users/${target.body.id}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(204);

      const after = await prisma.auditLog.findUnique({ where: { id: before!.id } });
      expect(after).not.toBeNull();
      expect(after?.actorId).toBeNull();
      // O e-mail histórico continua lá, senão o registro perderia o sentido.
      expect(after?.actorEmail).toBe('efemero@example.com');
    });

    it('nunca grava senha na trilha', async () => {
      await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({
          name: 'Alguem',
          email: 'alguem@example.com',
          password: 'SenhaSecreta@999',
          role: 'client',
        })
        .expect(201);

      const all = await prisma.auditLog.findMany();
      const dump = JSON.stringify(all);
      expect(dump).not.toContain('SenhaSecreta@999');
      expect(dump).not.toContain('Senha@123');
    });
  });

  // -------------------------------------------------------------------------
  describe('ações que a trilha não pode deixar passar', () => {
    it('registra o reuso de refresh token — o único indício de ataque da lista', async () => {
      const login = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'super@example.com', password: PASSWORD })
        .expect(200);

      // Primeiro refresh: legítimo, rotaciona o token.
      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: login.body.refreshToken })
        .expect(200);

      // Reapresentação do token já rotacionado.
      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);

      const entry = await prisma.auditLog.findFirst({
        where: { action: 'auth.refresh_reuse_detected' },
      });
      expect(entry).not.toBeNull();
      expect(entry?.entityId).toBe(superuserId);
    });

    it('registra o encerramento de todas as sessões com quantas caíram', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/logout-all`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(200);

      const entry = await prisma.auditLog.findFirst({
        where: { action: 'auth.logout_all' },
      });
      expect(entry?.entityId).toBe(superuserId);
      expect(entry?.metadata).toMatchObject({ revokedSessions: expect.any(Number) });
    });

    it('registra pedido e conclusão de recuperação de senha, sem mudar a resposta', async () => {
      const existente = await request(app.getHttpServer())
        .post(`${API}/auth/forgot-password`)
        .send({ email: 'super@example.com' })
        .expect(200);

      const inexistente = await request(app.getHttpServer())
        .post(`${API}/auth/forgot-password`)
        .send({ email: 'ninguem@example.com' })
        .expect(200);

      // A resposta continua indistinguível — a diferença vive só na trilha.
      expect(existente.body).toEqual(inexistente.body);

      const pedidos = await prisma.auditLog.findMany({
        where: { action: 'auth.password_reset_requested' },
      });
      expect(pedidos).toHaveLength(1);
      expect(pedidos[0].actorEmail).toBe('super@example.com');
    });

    it('registra criação de usuário com o privilégio concedido', async () => {
      const created = await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({
          name: 'Nascido Super',
          email: 'nascido@example.com',
          password: PASSWORD,
          role: 'technician',
          isSuperuser: true,
        })
        .expect(201);

      const entry = await prisma.auditLog.findFirst({
        where: { action: 'user.created' },
      });
      expect(entry).toMatchObject({ actorId: superuserId, entityId: created.body.id });
      // Sem isto a trilha mostraria o rebaixamento de um superuser mas não a
      // criação de outro já nascido com o mesmo poder.
      expect(entry?.metadata).toMatchObject({ isSuperuser: true, role: 'technician' });
    });

    it('registra edição comum pelos CAMPOS alterados, nunca pelos valores', async () => {
      const target = await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({
          name: 'Editavel',
          email: 'editavel@example.com',
          password: PASSWORD,
          role: 'client',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`${API}/users/${target.body.id}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ name: 'Editado', password: 'OutraSenha@777' })
        .expect(200);

      const entry = await prisma.auditLog.findFirst({
        where: { action: 'user.updated' },
      });
      expect(entry?.metadata).toMatchObject({ changedFields: 'name,password' });
      expect(JSON.stringify(entry?.metadata)).not.toContain('OutraSenha@777');
      expect(JSON.stringify(entry?.metadata)).not.toContain('Editado');
    });

    it('registra criação e renomeação de módulo com o nome anterior', async () => {
      const created = await request(app.getHttpServer())
        .post(`${API}/system-modules`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ name: 'Faturamento' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`${API}/system-modules/${created.body.id}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ name: 'Financeiro' })
        .expect(200);

      const criacao = await prisma.auditLog.findFirst({
        where: { action: 'system_module.created' },
      });
      expect(criacao?.metadata).toMatchObject({ name: 'Faturamento' });

      const edicao = await prisma.auditLog.findFirst({
        where: { action: 'system_module.updated' },
      });
      // Renomear muda o que aparece no histórico de todo chamado ligado ao
      // módulo; sem o nome anterior a trilha não permitiria reconstruir isso.
      expect(edicao?.metadata).toMatchObject({
        fromName: 'Faturamento',
        toName: 'Financeiro',
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('consulta da trilha (GET /audit)', () => {
    async function createClient(email: string): Promise<number> {
      const response = await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ name: 'Cliente', email, password: PASSWORD, role: 'client' })
        .expect(201);
      return response.body.id;
    }

    it('devolve a trilha ao superuser, do mais recente para o mais antigo', async () => {
      await createClient('c1@example.com');
      await createClient('c2@example.com');

      const response = await request(app.getHttpServer())
        .get(`${API}/audit`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(200);

      expect(response.body.total).toBeGreaterThanOrEqual(3); // login + 2 criações
      const ids: number[] = response.body.items.map((item: { id: number }) => item.id);
      expect(ids).toEqual([...ids].sort((a, b) => b - a));
    });

    it('recusa técnico comum e cliente', async () => {
      // A trilha registra quem fez o quê e de qual endereço: abri-la a todo
      // técnico transformaria a vigilância do privilégio em vigilância de colegas.
      await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({
          name: 'Tecnico',
          email: 'tecnico@example.com',
          password: PASSWORD,
          role: 'technician',
        })
        .expect(201);

      const login = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'tecnico@example.com', password: PASSWORD })
        .expect(200);

      await request(app.getHttpServer())
        .get(`${API}/audit`)
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(403);
    });

    it('exige autenticação', async () => {
      await request(app.getHttpServer()).get(`${API}/audit`).expect(401);
    });

    it('filtra por ação e por entidade', async () => {
      const clientId = await createClient('filtro@example.com');

      const byAction = await request(app.getHttpServer())
        .get(`${API}/audit`)
        .query({ action: 'user.created' })
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(200);

      expect(byAction.body.items).toHaveLength(1);
      expect(byAction.body.items[0].entityId).toBe(clientId);

      const byEntity = await request(app.getHttpServer())
        .get(`${API}/audit`)
        .query({ entityType: 'user', entityId: clientId })
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(200);

      expect(byEntity.body.items.length).toBeGreaterThanOrEqual(1);
      expect(
        byEntity.body.items.every(
          (item: { entityId: number }) => item.entityId === clientId,
        ),
      ).toBe(true);
    });

    it('recusa ação desconhecida em vez de devolver trilha vazia', async () => {
      // Uma lista vazia seria lida como "nada aconteceu" — a conclusão errada
      // mais cara que esta consulta pode produzir.
      await request(app.getHttpServer())
        .get(`${API}/audit`)
        .query({ action: 'user.deletado' })
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(400);
    });

    it('pagina com fim de período exclusivo', async () => {
      await createClient('p1@example.com');
      await createClient('p2@example.com');

      const page = await request(app.getHttpServer())
        .get(`${API}/audit`)
        .query({ page: 1, pageSize: 2 })
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(200);

      expect(page.body.items).toHaveLength(2);
      expect(page.body.pageSize).toBe(2);
      expect(page.body.totalPages).toBeGreaterThanOrEqual(2);

      // Um `to` anterior a tudo o que existe devolve vazio — é o que prova que
      // o filtro de período está sendo aplicado, e não ignorado.
      const antes = await request(app.getHttpServer())
        .get(`${API}/audit`)
        .query({ to: '2020-01-01T00:00:00.000Z' })
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(200);

      expect(antes.body.total).toBe(0);
    });

    it('mostra o ator histórico mesmo depois de o usuário ser excluído', async () => {
      const targetId = await createClient('sumico@example.com');

      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'sumico@example.com', password: PASSWORD })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`${API}/users/${targetId}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(204);

      const response = await request(app.getHttpServer())
        .get(`${API}/audit`)
        .query({ action: 'auth.login_succeeded' })
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(200);

      const entry = response.body.items.find(
        (item: { actor: { email: string | null } }) =>
          item.actor.email === 'sumico@example.com',
      );
      expect(entry).toBeDefined();
      expect(entry.actor.id).toBeNull();
      expect(entry.actor.name).toBeNull();
    });

    it('não expõe rota de escrita nem de exclusão da trilha', async () => {
      // Trilha que a própria API deixa apagar não serve como trilha.
      await request(app.getHttpServer())
        .post(`${API}/audit`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ action: 'user.created' })
        .expect(404);

      await request(app.getHttpServer())
        .delete(`${API}/audit/1`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(404);
    });
  });
});
