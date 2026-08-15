import { Prisma } from '@prisma/client';
import {
  addMonths,
  startOfNextMonth,
  storageToWallClock,
  wallClockToStorage,
} from '../common/time/legacy-clock';

/**
 * Motor de cálculo do banco de horas — **serviço de domínio puro**.
 *
 * Sem banco, sem HTTP, sem injeção: recebe os dados e devolve o resultado. Toda
 * a paridade com o Flask é verificada por 34 casos dourados gerados executando
 * `calculate_accumulated_hours` do próprio `app.py`
 * (`scripts/gen_hours_bank_golden.py`).
 *
 * ## Espaço temporal
 *
 * Tudo aqui opera em **hora de parede** de America/Sao_Paulo, porque é o que o
 * legado faz: `reference` vem de `datetime.now()` (local),
 * `activity.started_at` / `ended_at` são parede, e `hours_bank_closing_date` é
 * uma data de parede. Ver docs/LEGACY_CONTRACTS.md §4 e §10.
 *
 * ## Precisão
 *
 * O legado usa `float`. Aqui as horas são acumuladas em **milissegundos
 * inteiros** e só convertidas para horas no fim, e os valores monetários/horas
 * pagas usam `Decimal`. Isso elimina o erro de ponto flutuante do legado sem
 * mudar nenhum resultado arredondado a 2 casas — o que os casos dourados
 * confirmam.
 */

/** Franquia padrão quando o parâmetro está ausente ou inválido. */
export const DEFAULT_MONTHLY_HOURS_ALLOWANCE = 16;

export interface HoursBankActivity {
  /** Hora de parede armazenada. */
  startedAt: Date;
  /** Hora de parede armazenada. */
  endedAt: Date;
}

export interface HoursBankPayment {
  /** Data pura (meia-noite UTC), como gravado em `payment_record.paid_at`. */
  paidAt: Date;
  paidHours: Prisma.Decimal | string | number;
}

export interface HoursBankInput {
  /** Valor cru de `monthly_hours_allowance`; aceita vírgula decimal. */
  monthlyHoursAllowanceRaw: string;
  /** Valor cru de `hours_bank_closing_date`; inválido cai para 1º de janeiro. */
  hoursBankClosingDateRaw: string;
  /** "Agora" em hora de parede armazenada. */
  reference: Date;
  /** Atividades já no escopo do usuário (o filtro por cliente é do service). */
  activities: HoursBankActivity[];
  /** Pagamentos do período; o recorte por ciclo é feito aqui. */
  payments: HoursBankPayment[];
}

export interface MonthlyBreakdown {
  year: number;
  month: number;
  /** Horas consumidas no mês, dentro do ciclo e até a referência. */
  consumedHours: number;
  /** `max(consumido - franquia, 0)`. */
  excessHours: number;
}

export interface HoursBankResult {
  /** `max(excesso total - horas pagas, 0)`, 2 casas. Nunca negativo. */
  netAccumulatedHours: number;
  /** Excesso somado antes do desconto, 2 casas. */
  grossExcessHours: number;
  /** Horas pagas dentro do ciclo, 2 casas. */
  paidHoursInCycle: number;
  /** Franquia mensal efetiva, 2 casas. */
  franchiseHours: number;
  /** Início do ciclo (parede armazenada). */
  cycleStart: Date;
  /** Fim do ciclo, exclusivo (parede armazenada). */
  cycleEnd: Date;
  /** Consumo mês a mês, para exibição e conferência. */
  monthlyBreakdown: MonthlyBreakdown[];
  /** Total consumido no ciclo, 2 casas. */
  totalConsumedHours: number;
}

const MS_PER_HOUR = 3_600_000;

/**
 * `resolve_hours_bank_window` do legado.
 *
 * Recua de 6 em 6 meses até a âncora não ser futura, depois avança de 6 em 6
 * enquanto o próximo reset não passar da referência. Data inválida ou vazia cai
 * para **1º de janeiro do ano da referência**.
 */
export function resolveHoursBankWindow(
  closingDateRaw: string,
  reference: Date,
): { cycleStart: Date; cycleEnd: Date } {
  let anchor = parseClosingDate(closingDateRaw, reference);

  while (anchor.getTime() > reference.getTime()) {
    anchor = addMonths(anchor, -6);
  }

  let nextReset = addMonths(anchor, 6);
  while (nextReset.getTime() <= reference.getTime()) {
    anchor = nextReset;
    nextReset = addMonths(anchor, 6);
  }

  return { cycleStart: anchor, cycleEnd: nextReset };
}

function parseClosingDate(raw: string, reference: Date): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((raw ?? '').trim());

  if (match) {
    const [year, month, day] = match.slice(1).map(Number);
    const candidate = wallClockToStorage({
      year,
      month,
      day,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    const roundTrip = storageToWallClock(candidate);
    // Data impossível (2026-02-30) é tratada como inválida, como o strptime.
    if (roundTrip.year === year && roundTrip.month === month && roundTrip.day === day) {
      return candidate;
    }
  }

  // Fallback do legado: reference.replace(month=1, day=1, ...).
  const referenceParts = storageToWallClock(reference);
  return wallClockToStorage({
    year: referenceParts.year,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
}

/**
 * `monthly_hours_allowance` do legado: aceita vírgula decimal, cai para 16 se
 * não for numérico, e nunca é negativo (`max(value, 0)`).
 */
export function resolveFranchiseHours(raw: string): number {
  const normalized = (raw ?? '').trim().replace(',', '.');
  const parsed = Number(normalized);

  if (normalized === '' || !Number.isFinite(parsed)) {
    return DEFAULT_MONTHLY_HOURS_ALLOWANCE;
  }
  return Math.max(parsed, 0);
}

/** Chave de mês, para acumular por mês civil. */
function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Arredondamento de 2 casas equivalente ao `round()` do Python para estes valores. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateHoursBank(input: HoursBankInput): HoursBankResult {
  const franchiseHours = resolveFranchiseHours(input.monthlyHoursAllowanceRaw);
  const { cycleStart, cycleEnd } = resolveHoursBankWindow(
    input.hoursBankClosingDateRaw,
    input.reference,
  );

  // Acumula em milissegundos inteiros: soma exata, sem erro de float.
  const monthlyMilliseconds = new Map<string, number>();

  for (const activity of input.activities) {
    // Escopo do legado: ended_at > cycle_start AND started_at < reference.
    if (
      activity.endedAt.getTime() <= cycleStart.getTime() ||
      activity.startedAt.getTime() >= input.reference.getTime()
    ) {
      continue;
    }

    // Recorte da atividade na janela [cycle_start, reference].
    const overlapStart = new Date(
      Math.max(activity.startedAt.getTime(), cycleStart.getTime()),
    );
    const overlapEnd = new Date(
      Math.min(activity.endedAt.getTime(), input.reference.getTime()),
    );
    if (overlapEnd.getTime() <= overlapStart.getTime()) continue;

    // Fatiamento por mês civil: cada mês atravessado recebe sua parte.
    let cursor = overlapStart;
    while (cursor.getTime() < overlapEnd.getTime()) {
      const nextMonth = startOfNextMonth(cursor);
      const segmentEnd = new Date(Math.min(overlapEnd.getTime(), nextMonth.getTime()));

      const { year, month } = storageToWallClock(cursor);
      const key = monthKey(year, month);
      monthlyMilliseconds.set(
        key,
        (monthlyMilliseconds.get(key) ?? 0) + (segmentEnd.getTime() - cursor.getTime()),
      );

      cursor = segmentEnd;
    }
  }

  const monthlyBreakdown: MonthlyBreakdown[] = Array.from(monthlyMilliseconds.entries())
    .map(([key, milliseconds]) => {
      const [year, month] = key.split('-').map(Number);
      const consumedHours = milliseconds / MS_PER_HOUR;
      return {
        year,
        month,
        consumedHours: round2(consumedHours),
        excessHours: round2(Math.max(consumedHours - franchiseHours, 0)),
      };
    })
    .sort((left, right) =>
      left.year !== right.year ? left.year - right.year : left.month - right.month,
    );

  // Excesso somado mês a mês, sem compensar um mês contra outro.
  let grossExcessMilliseconds = 0;
  for (const milliseconds of monthlyMilliseconds.values()) {
    const franchiseMilliseconds = franchiseHours * MS_PER_HOUR;
    grossExcessMilliseconds += Math.max(milliseconds - franchiseMilliseconds, 0);
  }
  const grossExcessHours = grossExcessMilliseconds / MS_PER_HOUR;

  // Horas pagas no ciclo: paid_at entre cycle_start e reference, INCLUSIVE nas
  // duas pontas (o legado usa >= e <= sobre as datas).
  const cycleStartDate = toDateOnlyKey(cycleStart);
  const referenceDate = toDateOnlyKey(input.reference);

  let paidHoursDecimal = new Prisma.Decimal(0);
  for (const payment of input.payments) {
    const paidAtKey = toDateOnlyKey(payment.paidAt);
    if (paidAtKey >= cycleStartDate && paidAtKey <= referenceDate) {
      paidHoursDecimal = paidHoursDecimal.plus(
        new Prisma.Decimal(payment.paidHours as Prisma.Decimal.Value),
      );
    }
  }
  // O legado arredonda as horas pagas ANTES de subtrair.
  const paidHoursInCycle = round2(paidHoursDecimal.toNumber());

  const netAccumulatedHours = Math.max(grossExcessHours - paidHoursInCycle, 0);

  const totalConsumedMilliseconds = Array.from(monthlyMilliseconds.values()).reduce(
    (total, value) => total + value,
    0,
  );

  return {
    netAccumulatedHours: round2(netAccumulatedHours),
    grossExcessHours: round2(grossExcessHours),
    paidHoursInCycle,
    franchiseHours: round2(franchiseHours),
    cycleStart,
    cycleEnd,
    monthlyBreakdown,
    totalConsumedHours: round2(totalConsumedMilliseconds / MS_PER_HOUR),
  };
}

/**
 * Chave AAAAMMDD de uma data pura, para comparar sem envolver hora nem fuso.
 * `paid_at` é DATE no banco, então os componentes UTC são a própria data.
 */
function toDateOnlyKey(date: Date): number {
  return (
    date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate()
  );
}

/**
 * `calculate_paid_hours_for_month` do legado.
 *
 * Atenção: aqui o limite superior é **exclusivo** (`< period_end.date()`),
 * diferente do `<= reference.date()` usado no ciclo.
 */
export function calculatePaidHoursForMonth(
  payments: HoursBankPayment[],
  year: number,
  month: number,
): number {
  const startKey = year * 10000 + month * 100 + 1;
  const endKey =
    month === 12
      ? (year + 1) * 10000 + 1 * 100 + 1
      : year * 10000 + (month + 1) * 100 + 1;

  let total = new Prisma.Decimal(0);
  for (const payment of payments) {
    const key = toDateOnlyKey(payment.paidAt);
    if (key >= startKey && key < endKey) {
      total = total.plus(new Prisma.Decimal(payment.paidHours as Prisma.Decimal.Value));
    }
  }
  return round2(total.toNumber());
}
