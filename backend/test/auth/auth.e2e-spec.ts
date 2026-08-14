import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { hashResetToken } from '../../src/auth/auth.service';
import { API, createTestHarness } from '../app-harness';
import { truncateAll } from '../test-database';

const werkzeugVectors: { password: string; method: string; hash: string }[] =
  JSON.parse(
    readFileSync(join(__dirname, '../fixtures/werkzeug-vectors.json'), 'utf8'),
  ).vectors;

const LEGACY_SCRYPT = werkzeugVectors.find((v) => v.method === 'scrypt')!;

describe('Autenticação (Fase 02)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let close: () => Promise<void>;

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
  });

  /** Cria usuário com hash bcrypt real, via o próprio endpoint de cadastro. */
  async function createUser(overrides: {
    email: string;
    password: string;
    role?: string;
    isSuperuser?: boolean;
    mustChangePassword?: boolean;
    name?: string;
  }) {
    const { PasswordService } =
      await import('../../src/auth/password/password.service');
    const passwordHash = await new PasswordService().hash(overrides.password);
    return prisma.user.create({
      data: {
        name: overrides.name ?? 'Usuário de Teste',
        email: overrides.email,
        passwordHash,
        role: overrides.role ?? 'client',
        isSuperuser: overrides.isSuperuser ?? false,
        mustChangePassword: overrides.mustChangePassword ?? false,
      },
    });
  }

  async function login(email: string, password: string) {
    const response = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email, password })
      .expect(200);
    return response.body;
  }

  // -------------------------------------------------------------------------
  describe('POST /auth/login', () => {
    it('autentica com credenciais válidas e devolve o par de tokens', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });

      const body = await login('cliente@example.com', 'Senha@123');

      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.refreshToken).toEqual(expect.any(String));
      expect(body.tokenType).toBe('Bearer');
      expect(body.expiresIn).toBeGreaterThan(0);
      expect(body.user).toMatchObject({
        email: 'cliente@example.com',
        role: 'client',
        isSuperuser: false,
        mustChangePassword: false,
      });
    });

    it('nunca devolve o hash de senha nem o token de recuperação', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      const body = await login('cliente@example.com', 'Senha@123');

      const serialized = JSON.stringify(body);
      expect(serialized).not.toMatch(/passwordHash|password_hash/);
      expect(serialized).not.toMatch(/resetToken|reset_token/);
      expect(body.user.passwordHash).toBeUndefined();
    });

    it('normaliza o e-mail (trim e minúsculas)', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: '  CLIENTE@Example.COM  ', password: 'Senha@123' })
        .expect(200);
    });

    it('rejeita senha errada com a mesma mensagem de e-mail inexistente', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });

      const wrongPassword = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'cliente@example.com', password: 'errada' })
        .expect(401);

      const unknownEmail = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'ninguem@example.com', password: 'Senha@123' })
        .expect(401);

      // Não revela se a conta existe.
      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
      expect(wrongPassword.body.message).toBe('E-mail ou senha inválidos.');
    });

    it('rejeita corpo inválido com 400', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'nao-e-email', password: '' })
        .expect(400);
    });

    it('rejeita campos não declarados (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({
          email: 'cliente@example.com',
          password: 'Senha@123',
          isSuperuser: true,
        })
        .expect(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('compatibilidade com hash legado do Werkzeug', () => {
    it('autentica usuário com hash Werkzeug e faz rehash para bcrypt', async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Usuário Legado',
          email: 'legado@example.com',
          passwordHash: LEGACY_SCRYPT.hash,
          role: 'technician',
        },
      });

      // Confirma o ponto de partida: hash no formato do Werkzeug.
      expect(user.passwordHash.startsWith('scrypt:')).toBe(true);

      await login('legado@example.com', LEGACY_SCRYPT.password);

      const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      // Migrado de forma transparente, sem o usuário redefinir a senha.
      expect(after.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(after.passwordHash).not.toBe(LEGACY_SCRYPT.hash);
    });

    it('a senha continua válida após o rehash', async () => {
      await prisma.user.create({
        data: {
          name: 'Usuário Legado',
          email: 'legado@example.com',
          passwordHash: LEGACY_SCRYPT.hash,
          role: 'technician',
        },
      });

      await login('legado@example.com', LEGACY_SCRYPT.password);
      // Segundo login usa o hash bcrypt já regravado.
      await login('legado@example.com', LEGACY_SCRYPT.password);
    });

    it('rejeita senha errada contra hash legado', async () => {
      await prisma.user.create({
        data: {
          name: 'Usuário Legado',
          email: 'legado@example.com',
          passwordHash: LEGACY_SCRYPT.hash,
          role: 'technician',
        },
      });

      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'legado@example.com', password: 'senha-errada' })
        .expect(401);

      // Hash não deve ter sido tocado.
      const after = await prisma.user.findUniqueOrThrow({
        where: { email: 'legado@example.com' },
      });
      expect(after.passwordHash).toBe(LEGACY_SCRYPT.hash);
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /auth/me', () => {
    it('devolve o usuário autenticado', async () => {
      await createUser({
        email: 'tecnico@example.com',
        password: 'Senha@123',
        role: 'technician',
      });
      const { accessToken } = await login('tecnico@example.com', 'Senha@123');

      const response = await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        email: 'tecnico@example.com',
        role: 'technician',
      });
      expect(response.body.passwordHash).toBeUndefined();
    });

    it('exige autenticação', async () => {
      await request(app.getHttpServer()).get(`${API}/auth/me`).expect(401);
    });

    it.each([
      ['sem esquema Bearer', 'apenas-o-token'],
      ['esquema errado', 'Basic dXNlcjpwYXNz'],
      ['token corrompido', 'Bearer abc.def.ghi'],
      ['Bearer vazio', 'Bearer '],
    ])('rejeita header inválido: %s', async (_label, header) => {
      await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set('Authorization', header)
        .expect(401);
    });

    it('rejeita refresh token usado como access token', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      const { refreshToken } = await login('cliente@example.com', 'Senha@123');

      await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(401);
    });
  });

  // -------------------------------------------------------------------------
  describe('POST /auth/refresh (rotação)', () => {
    it('emite um par novo e revoga o token apresentado', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      const first = await login('cliente@example.com', 'Senha@123');

      const response = await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: first.refreshToken })
        .expect(200);

      expect(response.body.refreshToken).not.toBe(first.refreshToken);
      expect(response.body.accessToken).toEqual(expect.any(String));

      // O novo access token funciona.
      await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${response.body.accessToken}`)
        .expect(200);
    });

    it('registra o encadeamento da rotação', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      const first = await login('cliente@example.com', 'Senha@123');
      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: first.refreshToken })
        .expect(200);

      const tokens = await prisma.refreshToken.findMany({ orderBy: { id: 'asc' } });
      expect(tokens).toHaveLength(2);
      expect(tokens[0].revokedAt).not.toBeNull();
      expect(tokens[0].replacedByJti).toBe(tokens[1].jti);
      expect(tokens[1].revokedAt).toBeNull();
    });

    it('reuso de token rotacionado revoga TODAS as sessões do usuário', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      const first = await login('cliente@example.com', 'Senha@123');

      const second = await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: first.refreshToken })
        .expect(200);

      // Reapresenta o token antigo: sinal de roubo de token.
      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: first.refreshToken })
        .expect(401);

      // O token legítimo mais recente também foi invalidado.
      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: second.body.refreshToken })
        .expect(401);

      const active = await prisma.refreshToken.count({ where: { revokedAt: null } });
      expect(active).toBe(0);
    });

    it('rejeita refresh token expirado', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      const { refreshToken } = await login('cliente@example.com', 'Senha@123');

      await prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken })
        .expect(401);
    });

    it('rejeita refresh token de usuário removido', async () => {
      const user = await createUser({
        email: 'cliente@example.com',
        password: 'Senha@123',
      });
      const { refreshToken } = await login('cliente@example.com', 'Senha@123');

      await prisma.user.delete({ where: { id: user.id } });

      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken })
        .expect(401);
    });

    it('rejeita access token usado como refresh token', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      const { accessToken } = await login('cliente@example.com', 'Senha@123');

      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: accessToken })
        .expect(401);
    });

    it('rejeita token forjado', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.forjado' })
        .expect(401);
    });
  });

  // -------------------------------------------------------------------------
  describe('POST /auth/logout', () => {
    it('revoga o refresh token informado', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      const { refreshToken } = await login('cliente@example.com', 'Senha@123');

      await request(app.getHttpServer())
        .post(`${API}/auth/logout`)
        .send({ refreshToken })
        .expect(200);

      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken })
        .expect(401);
    });

    it('é idempotente e não falha com token inválido', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/logout`)
        .send({ refreshToken: 'token-invalido' })
        .expect(200);
    });
  });

  describe('POST /auth/logout-all', () => {
    it('revoga todas as sessões do usuário', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      const first = await login('cliente@example.com', 'Senha@123');
      const second = await login('cliente@example.com', 'Senha@123');

      await request(app.getHttpServer())
        .post(`${API}/auth/logout-all`)
        .set('Authorization', `Bearer ${first.accessToken}`)
        .expect(200);

      for (const token of [first.refreshToken, second.refreshToken]) {
        await request(app.getHttpServer())
          .post(`${API}/auth/refresh`)
          .send({ refreshToken: token })
          .expect(401);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('POST /auth/change-password', () => {
    it('troca a senha e encerra as sessões existentes', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      const session = await login('cliente@example.com', 'Senha@123');

      await request(app.getHttpServer())
        .post(`${API}/auth/change-password`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          currentPassword: 'Senha@123',
          password: 'NovaSenha@456',
          confirmation: 'NovaSenha@456',
        })
        .expect(200);

      // Senha antiga não vale mais.
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'cliente@example.com', password: 'Senha@123' })
        .expect(401);

      // Senha nova vale.
      await login('cliente@example.com', 'NovaSenha@456');

      // Sessão anterior foi encerrada.
      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: session.refreshToken })
        .expect(401);
    });

    it('recusa senha atual incorreta', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      const { accessToken } = await login('cliente@example.com', 'Senha@123');

      await request(app.getHttpServer())
        .post(`${API}/auth/change-password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'errada',
          password: 'NovaSenha@456',
          confirmation: 'NovaSenha@456',
        })
        .expect(400);
    });

    it('recusa confirmação divergente', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      const { accessToken } = await login('cliente@example.com', 'Senha@123');

      const response = await request(app.getHttpServer())
        .post(`${API}/auth/change-password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Senha@123',
          password: 'NovaSenha@456',
          confirmation: 'Outra@789',
        })
        .expect(400);

      expect(response.body.message).toMatch(/confirmação não confere/i);
    });

    it('recusa senha nova igual à atual', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      const { accessToken } = await login('cliente@example.com', 'Senha@123');

      await request(app.getHttpServer())
        .post(`${API}/auth/change-password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Senha@123',
          password: 'Senha@123',
          confirmation: 'Senha@123',
        })
        .expect(400);
    });

    it('recusa senha com menos de 6 caracteres (regra do legado)', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      const { accessToken } = await login('cliente@example.com', 'Senha@123');

      await request(app.getHttpServer())
        .post(`${API}/auth/change-password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Senha@123',
          password: '12345',
          confirmation: '12345',
        })
        .expect(400);
    });

    it('aceita exatamente 6 caracteres', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      const { accessToken } = await login('cliente@example.com', 'Senha@123');

      await request(app.getHttpServer())
        .post(`${API}/auth/change-password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Senha@123',
          password: '123456',
          confirmation: '123456',
        })
        .expect(200);
    });
  });

  // -------------------------------------------------------------------------
  describe('mustChangePassword (enforce_password_change do legado)', () => {
    it('bloqueia rotas comuns até a senha ser trocada', async () => {
      await createUser({
        email: 'novo@example.com',
        password: 'Provisoria1',
        role: 'technician',
        mustChangePassword: true,
      });
      const { accessToken } = await login('novo@example.com', 'Provisoria1');

      const response = await request(app.getHttpServer())
        .get(`${API}/users`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body.message).toMatch(/definir uma nova senha/i);
    });

    it('permite /auth/me e a troca de senha', async () => {
      await createUser({
        email: 'novo@example.com',
        password: 'Provisoria1',
        role: 'technician',
        mustChangePassword: true,
      });
      const { accessToken } = await login('novo@example.com', 'Provisoria1');

      await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`${API}/auth/change-password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Provisoria1',
          password: 'Definitiva@1',
          confirmation: 'Definitiva@1',
        })
        .expect(200);
    });

    it('libera as rotas comuns após a troca', async () => {
      await createUser({
        email: 'novo@example.com',
        password: 'Provisoria1',
        role: 'technician',
        mustChangePassword: true,
      });
      const first = await login('novo@example.com', 'Provisoria1');

      await request(app.getHttpServer())
        .post(`${API}/auth/change-password`)
        .set('Authorization', `Bearer ${first.accessToken}`)
        .send({
          currentPassword: 'Provisoria1',
          password: 'Definitiva@1',
          confirmation: 'Definitiva@1',
        })
        .expect(200);

      const second = await login('novo@example.com', 'Definitiva@1');
      expect(second.user.mustChangePassword).toBe(false);

      await request(app.getHttpServer())
        .get(`${API}/users`)
        .set('Authorization', `Bearer ${second.accessToken}`)
        .expect(200);
    });
  });

  // -------------------------------------------------------------------------
  describe('recuperação de senha', () => {
    it('responde a mesma mensagem para e-mail existente e inexistente', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });

      const existing = await request(app.getHttpServer())
        .post(`${API}/auth/forgot-password`)
        .send({ email: 'cliente@example.com' })
        .expect(200);

      const missing = await request(app.getHttpServer())
        .post(`${API}/auth/forgot-password`)
        .send({ email: 'ninguem@example.com' })
        .expect(200);

      expect(existing.body.message).toBe(missing.body.message);
      // A resposta não deve conter o token.
      expect(JSON.stringify(existing.body)).not.toMatch(/token/i);
    });

    it('armazena apenas o hash do token, com expiração de 2 horas', async () => {
      const user = await createUser({
        email: 'cliente@example.com',
        password: 'Senha@123',
      });

      const before = Date.now();
      await request(app.getHttpServer())
        .post(`${API}/auth/forgot-password`)
        .send({ email: 'cliente@example.com' })
        .expect(200);

      const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stored.resetTokenHash).toMatch(/^[0-9a-f]{64}$/);

      const ttlHours =
        (stored.resetTokenExpiresAt!.getTime() - before) / (60 * 60 * 1000);
      expect(ttlHours).toBeGreaterThan(1.9);
      expect(ttlHours).toBeLessThan(2.1);
    });

    it('redefine a senha com token válido e invalida o token', async () => {
      const user = await createUser({
        email: 'cliente@example.com',
        password: 'Senha@123',
      });

      // Emite o token diretamente pelo service, para conhecer o valor em claro.
      const { AuthService } = await import('../../src/auth/auth.service');
      const authService = app.get(AuthService);
      const issued = await authService.issueResetToken('cliente@example.com');
      expect(issued).not.toBeNull();

      await request(app.getHttpServer())
        .post(`${API}/auth/reset-password`)
        .send({
          token: issued!.token,
          password: 'NovaSenha@456',
          confirmation: 'NovaSenha@456',
        })
        .expect(200);

      await login('cliente@example.com', 'NovaSenha@456');

      // Token de uso único.
      const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(after.resetTokenHash).toBeNull();
      expect(after.resetTokenExpiresAt).toBeNull();

      await request(app.getHttpServer())
        .post(`${API}/auth/reset-password`)
        .send({
          token: issued!.token,
          password: 'Terceira@789',
          confirmation: 'Terceira@789',
        })
        .expect(400);
    });

    it('rejeita token expirado', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });

      const { AuthService } = await import('../../src/auth/auth.service');
      const issued = await app.get(AuthService).issueResetToken('cliente@example.com');

      await prisma.user.update({
        where: { id: issued!.userId },
        data: { resetTokenExpiresAt: new Date(Date.now() - 1000) },
      });

      await request(app.getHttpServer())
        .post(`${API}/auth/reset-password`)
        .send({
          token: issued!.token,
          password: 'NovaSenha@456',
          confirmation: 'NovaSenha@456',
        })
        .expect(400);
    });

    it('rejeita token inexistente com a mesma mensagem de token expirado', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });

      const { AuthService } = await import('../../src/auth/auth.service');
      const issued = await app.get(AuthService).issueResetToken('cliente@example.com');
      await prisma.user.update({
        where: { id: issued!.userId },
        data: { resetTokenExpiresAt: new Date(Date.now() - 1000) },
      });

      const expired = await request(app.getHttpServer())
        .post(`${API}/auth/reset-password`)
        .send({
          token: issued!.token,
          password: 'NovaSenha@456',
          confirmation: 'NovaSenha@456',
        })
        .expect(400);

      const unknown = await request(app.getHttpServer())
        .post(`${API}/auth/reset-password`)
        .send({
          token: 'token-que-nunca-existiu',
          password: 'NovaSenha@456',
          confirmation: 'NovaSenha@456',
        })
        .expect(400);

      expect(expired.body.message).toBe(unknown.body.message);
    });

    it('o hash armazenado corresponde ao SHA-256 do token, como no legado', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });

      const { AuthService } = await import('../../src/auth/auth.service');
      const issued = await app.get(AuthService).issueResetToken('cliente@example.com');

      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: issued!.userId },
      });
      expect(stored.resetTokenHash).toBe(hashResetToken(issued!.token));
    });

    it('redefinir senha encerra todas as sessões', async () => {
      await createUser({ email: 'cliente@example.com', password: 'Senha@123' });
      const session = await login('cliente@example.com', 'Senha@123');

      const { AuthService } = await import('../../src/auth/auth.service');
      const issued = await app.get(AuthService).issueResetToken('cliente@example.com');

      await request(app.getHttpServer())
        .post(`${API}/auth/reset-password`)
        .send({
          token: issued!.token,
          password: 'NovaSenha@456',
          confirmation: 'NovaSenha@456',
        })
        .expect(200);

      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: session.refreshToken })
        .expect(401);
    });

    it('limpa a flag mustChangePassword ao redefinir', async () => {
      await createUser({
        email: 'cliente@example.com',
        password: 'Senha@123',
        mustChangePassword: true,
      });

      const { AuthService } = await import('../../src/auth/auth.service');
      const issued = await app.get(AuthService).issueResetToken('cliente@example.com');

      await request(app.getHttpServer())
        .post(`${API}/auth/reset-password`)
        .send({
          token: issued!.token,
          password: 'NovaSenha@456',
          confirmation: 'NovaSenha@456',
        })
        .expect(200);

      const body = await login('cliente@example.com', 'NovaSenha@456');
      expect(body.user.mustChangePassword).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('health é público', () => {
    it('responde sem autenticação', async () => {
      await request(app.getHttpServer()).get(`${API}/health`).expect(200);
      await request(app.getHttpServer()).get(`${API}/health/ready`).expect(200);
    });
  });
});
