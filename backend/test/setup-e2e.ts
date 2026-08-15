/**
 * Setup dos testes de integração.
 *
 * Estes testes exigem um PostgreSQL DESCARTÁVEL. Nunca aponte
 * TEST_DATABASE_URL/DATABASE_URL para a base de produção.
 */
import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';

import { assertDisposableDatabase } from '../src/common/safety/disposable-database';

// Jest não carrega .env sozinho; o ConfigModule só entra em cena depois.
loadDotenv();

// A suíte faz dezenas de logins seguidos e bateria no limite de taxa,
// transformando testes de autenticação em testes de rate limiting. O teto é
// levantado aqui; o spec dedicado (`security/rate-limit.e2e-spec.ts`) abaixa os
// seus próprios limites antes de subir a aplicação, então o recurso continua
// coberto.
//
// A atribuição é INCONDICIONAL de propósito. Com `??=`, os limites apertados
// que o spec de rate limiting escreve em `process.env` sobreviviam a ele: o
// `--runInBand` roda todos os arquivos no MESMO processo, e o ambiente não é
// restaurado entre eles. A suíte seguinte importava `throttler.config` já com
// limite 3 e recebia 429 no quarto login — 38 falhas que apareciam ou não
// conforme a ordem escolhida pelo sequencer do Jest. Como este setup roda
// antes de cada arquivo de teste, sobrescrever aqui devolve o teto alto a
// todos, e o spec dedicado continua vencendo porque atribui depois, no próprio
// corpo do arquivo.
process.env.THROTTLE_DEFAULT_LIMIT = '100000';
process.env.THROTTLE_AUTH_LIMIT = '100000';
process.env.THROTTLE_PASSWORD_RESET_LIMIT = '100000';

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';

if (!databaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL (ou DATABASE_URL) precisa apontar para um PostgreSQL descartável.',
  );
}

// A suíte executa `truncateAll` entre os casos: apontar para a base errada não
// deixa a suíte vermelha, APAGA os dados. A trava é lista de permissão porque a
// lista de bloqueio anterior não incluía o host real de produção — ver
// `disposable-database.ts`.
assertDisposableDatabase(
  databaseUrl,
  'rodar a suíte de integração (ela TRUNCA as tabelas)',
);

process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-access-secret-value';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-value';
process.env.MAIL_ENABLED = 'false';

jest.setTimeout(30000);
