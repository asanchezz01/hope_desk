import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma apontado para o PostgreSQL DESCARTÁVEL de testes.
 * `test/setup-e2e.ts` já garantiu que a URL não é de produção.
 */
export function createTestPrisma(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
    log: ['warn', 'error'],
  });
}

/**
 * Limpa todas as tabelas preservando o schema, e reposiciona as sequências
 * para que os IDs sejam previsíveis entre testes.
 */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "audit_log",
      "refresh_token",
      "activity",
      "ticket",
      "payment_record",
      "system_parameter",
      "system_module",
      "user"
    RESTART IDENTITY CASCADE;
  `);
}

/** Fixtures mínimas e explícitas, sem depender de estado anterior. */
export const FIXTURE_PASSWORD_HASH =
  'scrypt:32768:8:1$0WyB2VQGptHiQQVr$36293e62ec3b8b4f4354d3825691f779339e13a55b2a6d60d02ee582314e234c7f6fee85650347089e93432d9c846458793993004de420e06a4e924b673920d6';

export async function seedBaseUsers(prisma: PrismaClient) {
  const client = await prisma.user.create({
    data: {
      name: 'Cliente Um',
      email: 'cliente1@example.com',
      passwordHash: FIXTURE_PASSWORD_HASH,
      role: 'client',
    },
  });

  const technician = await prisma.user.create({
    data: {
      name: 'Tecnico Um',
      email: 'tecnico1@example.com',
      passwordHash: FIXTURE_PASSWORD_HASH,
      role: 'technician',
    },
  });

  const superuser = await prisma.user.create({
    data: {
      name: 'Super User',
      email: 'superuser@hope.com',
      passwordHash: FIXTURE_PASSWORD_HASH,
      role: 'technician',
      isSuperuser: true,
    },
  });

  return { client, technician, superuser };
}

export async function seedModule(prisma: PrismaClient, name = 'Financeiro') {
  return prisma.systemModule.create({ data: { name } });
}
