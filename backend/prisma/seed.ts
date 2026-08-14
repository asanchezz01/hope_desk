/**
 * Seed de DESENVOLVIMENTO.
 *
 * Reproduz `ensure_system_parameters()` e `ensure_superuser()` do legado.
 * Nunca deve ser executado contra a base de produção — o script recusa hosts
 * de produção conhecidos e exige SEED_PASSWORD fora de NODE_ENV=development.
 */
import { PrismaClient } from '@prisma/client';
import { SYSTEM_PARAMETER_DEFAULTS } from '../src/common/domain/legacy-enums';
import { PasswordService } from '../src/auth/password/password.service';

const PRODUCTION_HOST_MARKERS = ['farmacosprecodecusto.com.br', '10.1.4.82'];

/** Senha padrão apenas para desenvolvimento local. */
const DEV_DEFAULT_PASSWORD = 'Hope@2026';

function assertDisposableDatabase(): void {
  const url = process.env.DATABASE_URL ?? '';
  if (!url) {
    throw new Error('DATABASE_URL não definida.');
  }
  for (const marker of PRODUCTION_HOST_MARKERS) {
    if (url.includes(marker)) {
      throw new Error(
        `Recusando semear: DATABASE_URL aponta para host de produção (${marker}).`,
      );
    }
  }
}

function resolveSeedPassword(): string {
  const provided = (process.env.SEED_PASSWORD ?? '').trim();
  if (provided) return provided;

  // Fora de desenvolvimento, exige senha explícita — nada de default previsível.
  if ((process.env.NODE_ENV ?? 'development') !== 'development') {
    throw new Error(
      'SEED_PASSWORD é obrigatória quando NODE_ENV não é development.',
    );
  }
  return DEV_DEFAULT_PASSWORD;
}

async function main(): Promise<void> {
  assertDisposableDatabase();

  const password = resolveSeedPassword();
  const prisma = new PrismaClient();
  const passwords = new PasswordService();

  try {
    // Idempotente, como o legado: só cria o que falta.
    for (const [key, value] of Object.entries(SYSTEM_PARAMETER_DEFAULTS)) {
      await prisma.systemParameter.upsert({
        where: { key },
        update: {},
        create: { key, value },
      });
    }

    for (const name of ['Financeiro', 'Estoque', 'Fiscal']) {
      await prisma.systemModule.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }

    const passwordHash = await passwords.hash(password);

    // `ensure_superuser()` do legado usa este e-mail e força role=technician.
    const devUsers = [
      {
        email: 'superuser@hope.com',
        name: 'Super User',
        role: 'technician',
        isSuperuser: true,
      },
      {
        email: 'tecnico@hope.com',
        name: 'Técnico Demo',
        role: 'technician',
        isSuperuser: false,
      },
      {
        email: 'cliente@hope.com',
        name: 'Cliente Demo',
        role: 'client',
        isSuperuser: false,
      },
    ];

    for (const user of devUsers) {
      await prisma.user.upsert({
        where: { email: user.email },
        // Não sobrescreve a senha de um usuário já existente.
        update: { name: user.name, role: user.role, isSuperuser: user.isSuperuser },
        create: { ...user, passwordHash, mustChangePassword: false },
      });
    }

    const [parameters, modules, users] = await Promise.all([
      prisma.systemParameter.count(),
      prisma.systemModule.count(),
      prisma.user.count(),
    ]);

    console.log(
      `Seed concluído: ${parameters} parâmetros, ${modules} módulos, ${users} usuários.`,
    );
    if (!process.env.SEED_PASSWORD) {
      console.log(`Senha de desenvolvimento dos usuários criados: ${DEV_DEFAULT_PASSWORD}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
