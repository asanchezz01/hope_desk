/**
 * Rate limiting (Fase 11).
 *
 * Este spec sobe a aplicação com limites PRÓPRIOS e apertados. Os limites são
 * lidos do ambiente no momento em que `throttler.config.ts` é importado, então
 * eles precisam ser definidos **antes** de qualquer import que puxe o AppModule
 * — daí os `process.env` no topo e o `require` tardio dentro do `beforeAll`.
 *
 * Estas atribuições vazam para o resto do processo (`--runInBand` compartilha
 * um processo entre todos os arquivos). Quem neutraliza isso é o
 * `test/setup-e2e.ts`, que reescreve o teto alto antes de cada arquivo. Se
 * aquela atribuição virar condicional outra vez, toda suíte que rodar depois
 * desta passa a tomar 429 no quarto login.
 */
process.env.THROTTLE_DEFAULT_LIMIT = '1000';
process.env.THROTTLE_AUTH_LIMIT = '3';
process.env.THROTTLE_PASSWORD_RESET_LIMIT = '2';

import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { PasswordService } from '../../src/auth/password/password.service';
import { truncateAll } from '../test-database';

describe('Rate limiting (Fase 11)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let API: string;

  const PASSWORD = 'Senha@123';

  beforeAll(async () => {
    // Import tardio: garante que a configuração acima já esteja no ambiente.
    const harnessModule = await import('../app-harness');
    API = harnessModule.API;
    const harness = await harnessModule.createTestHarness();
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
    await prisma.user.create({
      data: {
        name: 'Alvo',
        email: 'alvo@example.com',
        passwordHash,
        role: 'client',
      },
    });
  });

  it('recusa a rajada de tentativas de login com 429', async () => {
    // O ponto: a Fase 02 fechou o canal lateral de LATÊNCIA, mas nada limitava
    // a TAXA. Com o limite em 3, a quarta tentativa precisa ser recusada.
    const attempts = [];
    for (let i = 0; i < 3; i += 1) {
      attempts.push(
        await request(app.getHttpServer())
          .post(`${API}/auth/login`)
          .send({ email: 'alvo@example.com', password: 'errada' }),
      );
    }
    expect(attempts.map((r) => r.status)).toEqual([401, 401, 401]);

    const blocked = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: 'alvo@example.com', password: 'errada' });

    expect(blocked.status).toBe(429);
  });

  it('bloqueia por IP, mesmo alternando o e-mail tentado', async () => {
    // Sem isto, bastaria variar o e-mail para varrer contas à vontade.
    for (let i = 0; i < 3; i += 1) {
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: `alvo${i}@example.com`, password: 'errada' });
    }

    const blocked = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: 'outro@example.com', password: 'errada' });

    expect(blocked.status).toBe(429);
  });

  it('a recusa vale também para credencial CORRETA', async () => {
    // O limite protege o endpoint, não o resultado: quem esgotou a cota espera,
    // ainda que acerte a senha. Se fosse diferente, o atacante teria um oráculo.
    for (let i = 0; i < 3; i += 1) {
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'alvo@example.com', password: 'errada' });
    }

    const blocked = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: 'alvo@example.com', password: PASSWORD });

    expect(blocked.status).toBe(429);
  });

  it('limita a recuperação de senha mais ainda — cada tentativa manda e-mail', async () => {
    const first = await request(app.getHttpServer())
      .post(`${API}/auth/forgot-password`)
      .send({ email: 'alvo@example.com' });
    const second = await request(app.getHttpServer())
      .post(`${API}/auth/forgot-password`)
      .send({ email: 'alvo@example.com' });
    const third = await request(app.getHttpServer())
      .post(`${API}/auth/forgot-password`)
      .send({ email: 'alvo@example.com' });

    expect([first.status, second.status]).toEqual([200, 200]);
    // Abuso aqui vira spam contra um terceiro, não só carga no servidor.
    expect(third.status).toBe(429);
  });

  it('não afeta as rotas comuns, que têm limite próprio', async () => {
    // Um limite de autenticação apertado não pode derrubar o uso normal da API.
    for (let i = 0; i < 20; i += 1) {
      await request(app.getHttpServer()).get(`${API}/health`).expect(200);
    }
  });
});
