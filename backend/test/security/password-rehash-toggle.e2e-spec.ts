/**
 * Interruptor do rehash de senha (cutover).
 *
 * O rehash para bcrypt é endurecimento — e é também uma porta de mão única: o
 * Werkzeug do Flask não lê bcrypt, então cada login no sistema novo tranca
 * aquele usuário fora do sistema antigo. Enquanto os dois convivem, o rehash
 * precisa ficar desligado.
 *
 * Este spec sobe a aplicação com `PASSWORD_REHASH_ENABLED=false` e verifica as
 * duas metades do que isso significa: o login continua funcionando, e o hash
 * NÃO é tocado. A segunda é a que importa — um teste que só verificasse o login
 * passaria mesmo com o rehash ligado.
 */
process.env.PASSWORD_REHASH_ENABLED = 'false';

import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';

import { truncateAll } from '../test-database';

// O MESMO vetor real usado pela suíte de autenticação: gerado pelo Werkzeug
// 3.1.3 do venv do legado, não escrito à mão. Um hash inventado seria rejeitado
// e o teste passaria pelo motivo errado.
const werkzeugVectors: { password: string; method: string; hash: string }[] =
  JSON.parse(
    readFileSync(join(__dirname, '../fixtures/werkzeug-vectors.json'), 'utf8'),
  ).vectors;

const LEGACY_SCRYPT = werkzeugVectors.find((vector) => vector.method === 'scrypt')!;

describe('Rehash de senha desligado (operação paralela)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let API: string;

  beforeAll(async () => {
    // Import tardio: a configuração acima precisa estar no ambiente antes de
    // qualquer módulo ler `PASSWORD_REHASH_ENABLED`.
    const harnessModule = await import('../app-harness');
    API = harnessModule.API;
    const harness = await harnessModule.createTestHarness();
    app = harness.app;
    prisma = harness.prisma;
    close = harness.close;
  });

  afterAll(async () => {
    delete process.env.PASSWORD_REHASH_ENABLED;
    await close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  it('autentica com hash Werkzeug e NÃO regrava o hash', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Usuário Legado',
        email: 'legado@example.com',
        passwordHash: LEGACY_SCRYPT.hash,
        role: 'technician',
      },
    });

    await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: 'legado@example.com', password: LEGACY_SCRYPT.password })
      .expect(200);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    // Byte a byte igual: é isso que mantém o Flask conseguindo autenticar.
    expect(after.passwordHash).toBe(LEGACY_SCRYPT.hash);
    expect(after.passwordHash.startsWith('scrypt:')).toBe(true);
  });

  it('a trilha distingue "não precisava" de "precisava e foi adiado"', async () => {
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
      .send({ email: 'legado@example.com', password: LEGACY_SCRYPT.password })
      .expect(200);

    const entry = await prisma.auditLog.findFirst({
      where: { action: 'auth.login_succeeded' },
      orderBy: { id: 'desc' },
    });

    // Sem `rehashPending`, a trilha registraria `rehashed: false` e ninguém
    // saberia que existe um hash legado esperando conversão.
    expect(entry?.metadata).toMatchObject({ rehashed: false, rehashPending: true });
  });
});
