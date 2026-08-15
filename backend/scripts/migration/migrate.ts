/**
 * Fase 12 — passo 3: transforma a cópia do legado no schema novo.
 *
 * Origem  : `hopedesk_legacy` (cópia crua restaurada do dump de produção)
 * Destino : a base do `DATABASE_URL` do backend (schema Prisma)
 *
 * Nada aqui toca a produção: as duas pontas passam pela trava de destino
 * descartável, e a origem é lida apenas com SELECT.
 *
 * ## Simulação por padrão
 *
 * Sem `--apply`, o script lê tudo, aplica as conversões, valida e **desfaz**.
 * É o "dry-run" que o roadmap pede, e é a mesma execução do modo real — não uma
 * aproximação —, porque roda dentro de uma transação que termina em ROLLBACK.
 * Um dry-run que não exercita a escrita não prova nada sobre constraints.
 *
 * ## Uso
 *
 *   npx tsx scripts/migration/migrate.ts              # simula
 *   npx tsx scripts/migration/migrate.ts --apply      # grava
 *   npx tsx scripts/migration/migrate.ts --apply --truncate-target
 */
import { PrismaClient } from '@prisma/client';
import { config as loadDotenv } from 'dotenv';

import { assertDisposableDatabase } from '../../src/common/safety/disposable-database';

loadDotenv();

const APPLY = process.argv.includes('--apply');
const TRUNCATE_TARGET = process.argv.includes('--truncate-target');

const LEGACY_URL =
  process.env.LEGACY_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/hopedesk_legacy?schema=public';
const TARGET_URL = process.env.DATABASE_URL ?? '';

/**
 * Ordem de inserção ditada pelas chaves estrangeiras (LEGACY_CONTRACTS §7).
 * `activity` depende de `ticket`, que depende de `user` e `system_module`.
 */
const TABLES = [
  'user',
  'system_module',
  'system_parameter',
  'payment_record',
  'ticket',
  'activity',
] as const;

type LegacyRow = Record<string, unknown>;

interface TableReport {
  tabela: string;
  origem: number;
  inseridas: number;
  ignoradas: number;
  motivo?: string;
}

async function main(): Promise<void> {
  assertDisposableDatabase(LEGACY_URL, 'ler a cópia do legado');
  assertDisposableDatabase(TARGET_URL, 'migrar os dados para o destino');

  const legacy = new PrismaClient({ datasources: { db: { url: LEGACY_URL } } });
  const target = new PrismaClient({ datasources: { db: { url: TARGET_URL } } });

  console.log(APPLY ? '== MIGRAÇÃO REAL ==' : '== SIMULAÇÃO (nada será gravado) ==');
  console.log(`origem : ${maskUrl(LEGACY_URL)}`);
  console.log(`destino: ${maskUrl(TARGET_URL)}`);
  console.log();

  try {
    const source = await readLegacy(legacy);
    const report = await writeTarget(target, source);

    console.table(report);

    const totalOrigem = report.reduce((sum, row) => sum + row.origem, 0);
    const totalInserido = report.reduce((sum, row) => sum + row.inseridas, 0);
    console.log(`\nlinhas na origem: ${totalOrigem} | inseridas: ${totalInserido}`);

    if (!APPLY) {
      console.log(
        '\nSimulação concluída — a transação foi desfeita. ' +
          'Repita com --apply para gravar.',
      );
    }
  } finally {
    await legacy.$disconnect();
    await target.$disconnect();
  }
}

/** Lê a cópia do legado. Só SELECT, e sempre ordenado por id (amostras estáveis). */
async function readLegacy(legacy: PrismaClient): Promise<Record<string, LegacyRow[]>> {
  const source: Record<string, LegacyRow[]> = {};

  for (const table of TABLES) {
    // `$queryRawUnsafe` porque o nome da tabela é interpolado — ele vem da
    // constante `TABLES` acima, nunca de entrada externa.
    source[table] = await legacy.$queryRawUnsafe<LegacyRow[]>(
      `SELECT * FROM "${table}" ORDER BY id`,
    );
    console.log(`origem ${table.padEnd(17)} ${source[table].length} linhas`);
  }

  console.log();
  return source;
}

async function writeTarget(
  target: PrismaClient,
  source: Record<string, LegacyRow[]>,
): Promise<TableReport[]> {
  const report: TableReport[] = [];

  await target
    .$transaction(
      async (tx) => {
        if (TRUNCATE_TARGET) {
          // `RESTART IDENTITY` zera as sequências; `CASCADE` cobre as FKs.
          // `audit_log` e `refresh_token` entram porque apontam para `user`.
          await tx.$executeRawUnsafe(`
          TRUNCATE TABLE
            activity, ticket, payment_record, system_parameter,
            system_module, refresh_token, audit_log, "user"
          RESTART IDENTITY CASCADE
        `);
          console.log('destino truncado.\n');
        }

        report.push(await migrateUsers(tx, source.user));
        report.push(await migrateModules(tx, source.system_module));
        report.push(await migrateParameters(tx, source.system_parameter));
        report.push(await migratePayments(tx, source.payment_record));
        report.push(await migrateTickets(tx, source.ticket, source.user, source.system_module));
        report.push(await migrateActivities(tx, source.activity, source.ticket, source.user));

        await resetSequences(tx);

        if (!APPLY) {
          // O ROLLBACK é provocado por exceção: é a única forma de desfazer uma
          // transação interativa do Prisma. Capturada logo abaixo.
          throw new DryRunRollback();
        }
      },
      // A migração inteira é uma transação só: ou entra tudo, ou não entra
      // nada. Um destino meio migrado seria pior do que nenhum.
      { timeout: 10 * 60 * 1000, maxWait: 30 * 1000 },
    )
    .catch((error: unknown) => {
      if (error instanceof DryRunRollback) return;
      throw error;
    });

  return report;
}

class DryRunRollback extends Error {
  constructor() {
    super('simulação: transação desfeita de propósito');
  }
}

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// Tabelas
// ---------------------------------------------------------------------------

async function migrateUsers(tx: Tx, rows: LegacyRow[]): Promise<TableReport> {
  let inseridas = 0;

  for (const row of rows) {
    await tx.user.create({
      data: {
        id: num(row.id),
        name: str(row.name),
        email: str(row.email),
        passwordHash: str(row.password_hash),
        role: str(row.role),
        // LEGACY_CONTRACTS §6.2: a coluna é nullable no legado porque o
        // SQLAlchemy só aplica o default na aplicação. Linha criada por SQL
        // bruto pode ter NULL, e a coluna nova é NOT NULL.
        isSuperuser: bool(row.is_superuser),
        mustChangePassword: bool(row.must_change_password),
        resetTokenHash: strOrNull(row.reset_token_hash),
        resetTokenExpiresAt: dateOrNull(row.reset_token_expires_at),
      },
    });
    inseridas += 1;
  }

  return { tabela: 'user', origem: rows.length, inseridas, ignoradas: 0 };
}

async function migrateModules(tx: Tx, rows: LegacyRow[]): Promise<TableReport> {
  // O destino tem índice único funcional em lower(name) (Fase 03), que o legado
  // não tinha: "Financeiro" e "financeiro" podiam coexistir lá. Se existirem, a
  // migração precisa parar e a decisão é humana — fundir os dois muda dados.
  const porNomeNormalizado = new Map<string, string>();
  for (const row of rows) {
    const nome = str(row.name);
    const chave = nome.toLowerCase();
    const anterior = porNomeNormalizado.get(chave);
    if (anterior !== undefined) {
      throw new Error(
        `Módulos com nome equivalente em caixa diferente: "${anterior}" e "${nome}". ` +
          `O destino tem índice único em lower(name) e recusaria os dois. ` +
          `Decida qual fica ANTES de migrar.`,
      );
    }
    porNomeNormalizado.set(chave, nome);
  }

  let inseridas = 0;
  for (const row of rows) {
    await tx.systemModule.create({
      data: {
        id: num(row.id),
        name: str(row.name),
        isActive: bool(row.is_active, true),
      },
    });
    inseridas += 1;
  }

  return { tabela: 'system_module', origem: rows.length, inseridas, ignoradas: 0 };
}

async function migrateParameters(tx: Tx, rows: LegacyRow[]): Promise<TableReport> {
  let inseridas = 0;
  for (const row of rows) {
    await tx.systemParameter.create({
      data: {
        id: num(row.id),
        key: str(row.key),
        value: str(row.value, ''),
      },
    });
    inseridas += 1;
  }

  return { tabela: 'system_parameter', origem: rows.length, inseridas, ignoradas: 0 };
}

async function migratePayments(tx: Tx, rows: LegacyRow[]): Promise<TableReport> {
  let inseridas = 0;
  for (const row of rows) {
    await tx.paymentRecord.create({
      data: {
        id: num(row.id),
        // LEGACY_CONTRACTS §6.3: `double precision` → `numeric`. O
        // arredondamento para 2 casas não muda nenhum valor exibido (o legado
        // já mostrava tudo com round(...,2)); o que muda é a precisão interna,
        // que passa a ser exata.
        paidAt: dateOnly(row.paid_at),
        amount: decimal2(row.amount),
        paidHours: decimal2(row.paid_hours),
        createdAt: date(row.created_at),
      },
    });
    inseridas += 1;
  }

  return { tabela: 'payment_record', origem: rows.length, inseridas, ignoradas: 0 };
}

async function migrateTickets(
  tx: Tx,
  rows: LegacyRow[],
  users: LegacyRow[],
  modules: LegacyRow[],
): Promise<TableReport> {
  const userIds = new Set(users.map((user) => num(user.id)));
  const moduleIds = new Set(modules.map((mod) => num(mod.id)));

  let inseridas = 0;
  let ignoradas = 0;
  const motivos: string[] = [];

  for (const row of rows) {
    const clientId = num(row.client_id);
    // Órfão: o legado não tem ON DELETE, então uma exclusão manual de usuário
    // pode ter deixado chamado apontando para ninguém. Migrar assim quebraria a
    // FK; pular em silêncio esconderia perda de dado. Fica no relatório.
    if (!userIds.has(clientId)) {
      ignoradas += 1;
      motivos.push(`ticket ${num(row.id)}: client_id ${clientId} inexistente`);
      continue;
    }

    const technicianId = numOrNull(row.technician_id);
    const systemModuleId = numOrNull(row.system_module_id);

    await tx.ticket.create({
      data: {
        id: num(row.id),
        title: str(row.title),
        description: str(row.description),
        status: str(row.status, 'aberto'),
        createdAt: date(row.created_at),
        clientId,
        technicianId: technicianId !== null && userIds.has(technicianId) ? technicianId : null,
        systemModuleId:
          systemModuleId !== null && moduleIds.has(systemModuleId) ? systemModuleId : null,
      },
    });
    inseridas += 1;
  }

  return {
    tabela: 'ticket',
    origem: rows.length,
    inseridas,
    ignoradas,
    motivo: motivos.slice(0, 3).join('; ') || undefined,
  };
}

async function migrateActivities(
  tx: Tx,
  rows: LegacyRow[],
  tickets: LegacyRow[],
  users: LegacyRow[],
): Promise<TableReport> {
  const ticketIds = new Set(tickets.map((ticket) => num(ticket.id)));
  const userIds = new Set(users.map((user) => num(user.id)));

  let inseridas = 0;
  let ignoradas = 0;
  const motivos: string[] = [];

  for (const row of rows) {
    const ticketId = num(row.ticket_id);
    const createdById = num(row.created_by_id);

    if (!ticketIds.has(ticketId) || !userIds.has(createdById)) {
      ignoradas += 1;
      motivos.push(`activity ${num(row.id)}: ticket ${ticketId} / autor ${createdById}`);
      continue;
    }

    await tx.activity.create({
      data: {
        id: num(row.id),
        ticketId,
        notes: str(row.notes),
        // LEGACY_CONTRACTS §4: started_at/ended_at são HORA DE PAREDE gravada
        // como timestamp sem fuso. O driver devolve um Date cujos componentes
        // UTC já são os componentes de parede — é exatamente a representação
        // que o `legacy-clock` usa. Reescrever seria deslocar tudo em 3 horas.
        startedAt: date(row.started_at),
        endedAt: date(row.ended_at),
        createdById,
      },
    });
    inseridas += 1;
  }

  return {
    tabela: 'activity',
    origem: rows.length,
    inseridas,
    ignoradas,
    motivo: motivos.slice(0, 3).join('; ') || undefined,
  };
}

/**
 * Reposiciona as sequências (LEGACY_CONTRACTS §7).
 *
 * Sem isto, o próximo INSERT da aplicação tentaria o id 1 — que já existe — e
 * falharia com violação de chave primária. É o erro clássico de migração com
 * IDs preservados, e ele só aparece no primeiro cadastro feito por um usuário.
 */
async function resetSequences(tx: Tx): Promise<void> {
  for (const table of TABLES) {
    await tx.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('"${table}"', 'id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM "${table}"), 1), 1)
      )
    `);
  }
  console.log('sequências reposicionadas.');
}

// ---------------------------------------------------------------------------
// Conversões
// ---------------------------------------------------------------------------

function num(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  throw new Error(`valor numérico esperado, veio ${typeof value}: ${String(value)}`);
}

function numOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : num(value);
}

function str(value: unknown, fallback?: string): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error('texto obrigatório veio nulo');
  }
  return String(value);
}

function strOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

/** `NULL → false`: LEGACY_CONTRACTS §6.2. */
function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return fallback;
  return Boolean(value);
}

function date(value: unknown): Date {
  if (value instanceof Date) return value;
  throw new Error(`data esperada, veio ${typeof value}: ${String(value)}`);
}

function dateOrNull(value: unknown): Date | null {
  return value === null || value === undefined ? null : date(value);
}

/** `paid_at` é data pura; o driver devolve meia-noite UTC, que é o correto. */
function dateOnly(value: unknown): Date {
  return date(value);
}

function decimal2(value: unknown): string {
  if (value === null || value === undefined) return '0.00';
  const asNumber = typeof value === 'number' ? value : Number(String(value));
  if (!Number.isFinite(asNumber)) {
    throw new Error(`valor monetário inválido: ${String(value)}`);
  }
  return asNumber.toFixed(2);
}

/** Nunca imprime a senha da URL. */
function maskUrl(url: string): string {
  return url.replace(/\/\/([^:]+):[^@]*@/, '//$1:***@');
}

main().catch((error: unknown) => {
  console.error('\nFALHA:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
