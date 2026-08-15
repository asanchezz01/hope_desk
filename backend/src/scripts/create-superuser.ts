/**
 * Cria o primeiro superusuário de uma base recém-criada.
 *
 * ## Por que existe
 *
 * O entrypoint aplica as migrations, então a base sobe com o schema completo e
 * **zero usuários**. Sem um usuário não há login, e sem login não há como criar
 * usuário pela API: a instalação nova fica inacessível a si mesma.
 *
 * O seed (`prisma/seed.ts`) não serve aqui — ele é de desenvolvimento, cria
 * usuários de demonstração e roda com `tsx`, que não existe na imagem de
 * produção. Este arquivo mora em `src/` de propósito: assim é compilado para
 * `dist/scripts/create-superuser.js` e viaja na imagem sem mudar o Dockerfile.
 *
 * ## Uso (na VPS)
 *
 *     docker compose -f docker-compose.prod.yml exec \
 *       -e ADMIN_EMAIL=voce@empresa.com \
 *       -e ADMIN_NAME='Seu Nome' \
 *       -e ADMIN_PASSWORD='senha-provisória-longa' \
 *       api node dist/scripts/create-superuser.js
 *
 * A senha é provisória por construção: o usuário criado nasce com
 * `mustChangePassword`, porque uma senha digitada em linha de comando fica no
 * histórico do shell e possivelmente no log do deploy. A API bloqueia todas as
 * rotas até a troca.
 *
 * É idempotente: rodar de novo com um e-mail que já existe **promove** o
 * usuário a superusuário e não toca na senha dele. Para regravar a senha —
 * caso de "perdi o acesso" — passe `--reset-password`.
 */
import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../auth/password/password.service';
import { assertDisposableDatabase } from '../common/safety/disposable-database';

/** Curto demais e a conta nasce frágil; a API exige o mesmo na troca. */
const MIN_PASSWORD_LENGTH = 8;

function required(name: string): string {
  const value = (process.env[name] ?? '').trim();
  if (!value) {
    throw new Error(`${name} é obrigatória.`);
  }
  return value;
}

async function main(): Promise<void> {
  // A trava recusa os hosts do Flask de forma inegociável. Aqui ela vale como
  // proteção contra o acidente clássico: apontar para a base do sistema antigo
  // e criar um usuário lá.
  assertDisposableDatabase(process.env.DATABASE_URL, 'criar superusuário');

  const email = required('ADMIN_EMAIL').toLowerCase();
  const name = required('ADMIN_NAME');
  const password = required('ADMIN_PASSWORD');
  const resetPassword = process.argv.includes('--reset-password');

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    );
  }

  const prisma = new PrismaClient();
  const passwords = new PasswordService();

  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (!existing) {
      const created = await prisma.user.create({
        data: {
          email,
          name,
          // O legado força `technician` no superusuário: o superusuário atende
          // chamados, e `client` restringiria a visão dele aos próprios.
          role: 'technician',
          isSuperuser: true,
          passwordHash: await passwords.hash(password),
          mustChangePassword: true,
        },
      });
      console.log(
        `Superusuário criado: ${created.email} (id ${created.id}). ` +
          'A senha informada é provisória — a API vai exigir a troca no primeiro login.',
      );
      return;
    }

    const updated = await prisma.user.update({
      where: { email },
      data: {
        isSuperuser: true,
        role: 'technician',
        ...(resetPassword
          ? {
              passwordHash: await passwords.hash(password),
              mustChangePassword: true,
            }
          : {}),
      },
    });

    console.log(
      resetPassword
        ? `Senha regravada e ${updated.email} promovido a superusuário. Troca exigida no próximo login.`
        : `${updated.email} já existia: promovido a superusuário, senha intacta. ` +
            'Use --reset-password para regravá-la.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
