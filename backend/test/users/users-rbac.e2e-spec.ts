import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { PasswordService } from '../../src/auth/password/password.service';
import { API, createTestHarness } from '../app-harness';
import { truncateAll } from '../test-database';

/**
 * Fase 02 — RBAC e proteção contra IDOR na gestão de usuários.
 *
 * A regra do legado é `@role_required("technician")`: cliente não acessa nada
 * aqui. Superuser passa em qualquer exigência de papel.
 */
describe('Usuários — RBAC e IDOR (Fase 02)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let passwords: PasswordService;

  const PASSWORD = 'Senha@123';

  let clientToken: string;
  let technicianToken: string;
  let superuserToken: string;
  let clientId: number;
  let technicianId: number;
  let superuserId: number;

  beforeAll(async () => {
    const harness = await createTestHarness();
    app = harness.app;
    prisma = harness.prisma;
    close = harness.close;
    passwords = new PasswordService();
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);

    const passwordHash = await passwords.hash(PASSWORD);
    const [client, technician, superuser] = await Promise.all([
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
          name: 'Tecnico Um',
          email: 'tecnico@example.com',
          passwordHash,
          role: 'technician',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Super User',
          email: 'superuser@hope.com',
          passwordHash,
          role: 'technician',
          isSuperuser: true,
        },
      }),
    ]);

    clientId = client.id;
    technicianId = technician.id;
    superuserId = superuser.id;

    [clientToken, technicianToken, superuserToken] = await Promise.all([
      loginAs('cliente@example.com'),
      loginAs('tecnico@example.com'),
      loginAs('superuser@hope.com'),
    ]);
  });

  async function loginAs(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(200);
    return response.body.accessToken;
  }

  // -------------------------------------------------------------------------
  describe('cliente não acessa a gestão de usuários', () => {
    it.each([
      ['GET', '/users'],
      ['GET', '/users/technicians'],
      ['GET', '/users/clients'],
    ])('%s %s devolve 403 para cliente', async (_method, path) => {
      await request(app.getHttpServer())
        .get(`${API}${path}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);
    });

    it('GET /users/:id devolve 403 para cliente, mesmo o próprio ID', async () => {
      // Ponto de IDOR: nem o próprio registro é acessível por esta rota admin.
      await request(app.getHttpServer())
        .get(`${API}/users/${clientId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);
    });

    it('POST /users devolve 403 para cliente', async () => {
      await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          name: 'Intruso',
          email: 'intruso@example.com',
          password: 'Senha@123',
          role: 'technician',
        })
        .expect(403);

      expect(await prisma.user.count()).toBe(3);
    });

    it('PATCH /users/:id devolve 403 para cliente', async () => {
      await request(app.getHttpServer())
        .patch(`${API}/users/${technicianId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ name: 'Alterado' })
        .expect(403);
    });

    it('cliente não consegue se promover a superuser', async () => {
      await request(app.getHttpServer())
        .patch(`${API}/users/${clientId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ isSuperuser: true })
        .expect(403);

      const after = await prisma.user.findUniqueOrThrow({ where: { id: clientId } });
      expect(after.isSuperuser).toBe(false);
    });

    it('DELETE /users/:id devolve 403 para cliente', async () => {
      await request(app.getHttpServer())
        .delete(`${API}/users/${technicianId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);

      expect(await prisma.user.count()).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  describe('técnico gerencia usuários', () => {
    it('lista usuários paginados', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/users`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.total).toBe(3);
      expect(response.body.items).toHaveLength(3);
      expect(response.body.page).toBe(1);
      // A projeção nunca inclui material sensível.
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|resetToken/);
    });

    it('respeita page e pageSize', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/users?page=2&pageSize=2`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.page).toBe(2);
      expect(response.body.totalPages).toBe(2);
    });

    it('filtra por papel', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/users?role=client`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.items[0].email).toBe('cliente@example.com');
    });

    it('busca por nome ou e-mail, sem diferenciar maiúsculas', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/users?search=TECNICO`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.items[0].email).toBe('tecnico@example.com');
    });

    it('cria usuário com hash bcrypt e senha funcional', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({
          name: 'Cliente Novo',
          email: 'novo@example.com',
          password: 'Senha@456',
          role: 'client',
        })
        .expect(201);

      expect(response.body.email).toBe('novo@example.com');
      expect(response.body.passwordHash).toBeUndefined();

      const created = await prisma.user.findUniqueOrThrow({
        where: { email: 'novo@example.com' },
      });
      expect(created.passwordHash).toMatch(/^\$2[aby]\$/);

      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'novo@example.com', password: 'Senha@456' })
        .expect(200);
    });

    it('recusa e-mail duplicado com 409', async () => {
      await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({
          name: 'Duplicado',
          email: 'cliente@example.com',
          password: 'Senha@456',
          role: 'client',
        })
        .expect(409);
    });

    it('normaliza e-mail e nome na criação', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({
          name: '  Nome Com Espaços  ',
          email: '  MAIUSCULO@Example.COM ',
          password: 'Senha@456',
          role: 'client',
        })
        .expect(201);

      expect(response.body.email).toBe('maiusculo@example.com');
      expect(response.body.name).toBe('Nome Com Espaços');
    });

    it.each([
      ['papel inválido', { role: 'admin' }],
      ['e-mail inválido', { email: 'nao-e-email' }],
      ['senha curta', { password: '12345' }],
      ['nome vazio', { name: '' }],
    ])('recusa payload inválido: %s', async (_label, override) => {
      await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({
          name: 'Válido',
          email: 'valido@example.com',
          password: 'Senha@456',
          role: 'client',
          ...override,
        })
        .expect(400);
    });

    it('atualiza nome e e-mail', async () => {
      const response = await request(app.getHttpServer())
        .patch(`${API}/users/${clientId}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ name: 'Cliente Renomeado', email: 'renomeado@example.com' })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Cliente Renomeado',
        email: 'renomeado@example.com',
      });
    });

    it('devolve 404 para usuário inexistente', async () => {
      await request(app.getHttpServer())
        .get(`${API}/users/999999`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(404);

      await request(app.getHttpServer())
        .patch(`${API}/users/999999`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ name: 'Fantasma' })
        .expect(404);

      await request(app.getHttpServer())
        .delete(`${API}/users/999999`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(404);
    });

    it('devolve 400 para ID não numérico', async () => {
      await request(app.getHttpServer())
        .get(`${API}/users/abc`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('escalada de privilégio', () => {
    it('técnico comum não concede superuser na criação', async () => {
      await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({
          name: 'Falso Super',
          email: 'falsosuper@example.com',
          password: 'Senha@456',
          role: 'technician',
          isSuperuser: true,
        })
        .expect(403);

      expect(
        await prisma.user.count({ where: { email: 'falsosuper@example.com' } }),
      ).toBe(0);
    });

    it('técnico comum não concede superuser na atualização', async () => {
      await request(app.getHttpServer())
        .patch(`${API}/users/${technicianId}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ isSuperuser: true })
        .expect(403);

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: technicianId },
      });
      expect(after.isSuperuser).toBe(false);
    });

    it('superuser concede superuser', async () => {
      const response = await request(app.getHttpServer())
        .patch(`${API}/users/${technicianId}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ isSuperuser: true })
        .expect(200);

      expect(response.body.isSuperuser).toBe(true);
    });

    it('superuser cria outro superuser', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({
          name: 'Outro Super',
          email: 'outrosuper@example.com',
          password: 'Senha@456',
          role: 'technician',
          isSuperuser: true,
        })
        .expect(201);

      expect(response.body.isSuperuser).toBe(true);
    });

    it('impede remover o último superuser', async () => {
      const response = await request(app.getHttpServer())
        .patch(`${API}/users/${superuserId}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ isSuperuser: false })
        .expect(400);

      expect(response.body.message).toMatch(/último superuser/i);
    });

    it('permite rebaixar um superuser quando há outro', async () => {
      await request(app.getHttpServer())
        .patch(`${API}/users/${technicianId}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ isSuperuser: true })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`${API}/users/${superuserId}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ isSuperuser: false })
        .expect(200);
    });

    it('impede alterar o próprio papel', async () => {
      await request(app.getHttpServer())
        .patch(`${API}/users/${technicianId}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ role: 'client' })
        .expect(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('invalidação de sessão em mudanças sensíveis', () => {
    it('trocar a senha de um usuário revoga as sessões dele', async () => {
      const victimSession = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'cliente@example.com', password: PASSWORD })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`${API}/users/${clientId}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ password: 'SenhaTrocada@1' })
        .expect(200);

      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: victimSession.body.refreshToken })
        .expect(401);

      // A senha nova funciona.
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'cliente@example.com', password: 'SenhaTrocada@1' })
        .expect(200);
    });

    it('alterar o papel revoga as sessões do usuário', async () => {
      const victimSession = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'cliente@example.com', password: PASSWORD })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`${API}/users/${clientId}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ role: 'technician' })
        .expect(200);

      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: victimSession.body.refreshToken })
        .expect(401);
    });

    it('exigir troca de senha revoga as sessões do usuário', async () => {
      const victimSession = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'cliente@example.com', password: PASSWORD })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`${API}/users/${clientId}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ mustChangePassword: true })
        .expect(200);

      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: victimSession.body.refreshToken })
        .expect(401);
    });
  });

  // -------------------------------------------------------------------------
  describe('exclusão de usuário (regras do legado)', () => {
    it('recusa excluir o próprio usuário', async () => {
      const response = await request(app.getHttpServer())
        .delete(`${API}/users/${technicianId}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(400);

      expect(response.body.message).toMatch(/próprio usuário/i);
    });

    it('recusa excluir usuário com chamados como cliente', async () => {
      await prisma.ticket.create({
        data: { title: 'Chamado', description: 'Descrição', clientId },
      });

      const response = await request(app.getHttpServer())
        .delete(`${API}/users/${clientId}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(409);

      expect(response.body.message).toMatch(/chamados ou atividades/i);
    });

    it('recusa excluir usuário com chamados como técnico', async () => {
      await prisma.ticket.create({
        data: {
          title: 'Chamado',
          description: 'Descrição',
          clientId,
          technicianId,
        },
      });

      await request(app.getHttpServer())
        .delete(`${API}/users/${technicianId}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(409);
    });

    it('recusa excluir usuário com atividades vinculadas', async () => {
      const ticket = await prisma.ticket.create({
        data: { title: 'Chamado', description: 'Descrição', clientId },
      });
      await prisma.activity.create({
        data: {
          ticketId: ticket.id,
          notes: 'Atividade',
          startedAt: new Date('2026-03-10T08:00:00.000Z'),
          endedAt: new Date('2026-03-10T10:00:00.000Z'),
          createdById: technicianId,
        },
      });

      await request(app.getHttpServer())
        .delete(`${API}/users/${technicianId}`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(409);
    });

    it('exclui usuário sem vínculos', async () => {
      const created = await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({
          name: 'Descartável',
          email: 'descartavel@example.com',
          password: 'Senha@456',
          role: 'client',
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`${API}/users/${created.body.id}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(204);

      expect(await prisma.user.count({ where: { id: created.body.id } })).toBe(0);
    });

    it('excluir usuário remove os refresh tokens dele', async () => {
      const created = await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({
          name: 'Descartável',
          email: 'descartavel@example.com',
          password: 'Senha@456',
          role: 'client',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'descartavel@example.com', password: 'Senha@456' })
        .expect(200);

      expect(
        await prisma.refreshToken.count({ where: { userId: created.body.id } }),
      ).toBe(1);

      await request(app.getHttpServer())
        .delete(`${API}/users/${created.body.id}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(204);

      expect(
        await prisma.refreshToken.count({ where: { userId: created.body.id } }),
      ).toBe(0);
    });

    it('recusa excluir o último superuser', async () => {
      await request(app.getHttpServer())
        .delete(`${API}/users/${superuserId}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('listas auxiliares', () => {
    it('lista apenas técnicos', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/users/technicians`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      for (const user of response.body) {
        expect(user.role).toBe('technician');
      }
    });

    it('lista apenas clientes', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/users/clients`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].role).toBe('client');
    });
  });

  // -------------------------------------------------------------------------
  describe('sem autenticação', () => {
    it.each([
      ['GET', '/users'],
      ['GET', '/users/1'],
      ['POST', '/users'],
      ['PATCH', '/users/1'],
      ['DELETE', '/users/1'],
    ])('%s %s exige token', async (method, path) => {
      const server = request(app.getHttpServer());
      const call = {
        GET: () => server.get(`${API}${path}`),
        POST: () => server.post(`${API}${path}`),
        PATCH: () => server.patch(`${API}${path}`),
        DELETE: () => server.delete(`${API}${path}`),
      }[method]!;

      await call().expect(401);
    });
  });
});
