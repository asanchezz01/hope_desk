/**
 * Setup dos testes de integração.
 *
 * Estes testes exigem um PostgreSQL DESCARTÁVEL. Nunca aponte
 * TEST_DATABASE_URL/DATABASE_URL para a base de produção.
 */
import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';

// Jest não carrega .env sozinho; o ConfigModule só entra em cena depois.
loadDotenv();

const PRODUCTION_HOST_MARKERS = ['farmacosprecodecusto.com.br', '10.1.4.82'];

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';

if (!databaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL (ou DATABASE_URL) precisa apontar para um PostgreSQL descartável.',
  );
}

for (const marker of PRODUCTION_HOST_MARKERS) {
  if (databaseUrl.includes(marker)) {
    throw new Error(
      `Recusando rodar testes: a URL do banco aponta para um host de produção conhecido (${marker}).`,
    );
  }
}

process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-access-secret-value';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-value';
process.env.MAIL_ENABLED = 'false';

jest.setTimeout(30000);
