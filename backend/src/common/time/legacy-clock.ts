/**
 * Tempo compatível com o legado.
 *
 * O monólito Flask grava dois tipos diferentes de valor na MESMA espécie de
 * coluna (`timestamp without time zone`):
 *
 *   1. `created_at` / `reset_token_expires_at` — `datetime.utcnow()`, ou seja
 *      um INSTANTE UTC gravado sem fuso.
 *   2. `activity.started_at` / `activity.ended_at` — resultado de
 *      `datetime.fromisoformat()` sobre um `<input type="datetime-local">`,
 *      ou seja a HORA DE PAREDE do usuário (America/Sao_Paulo) gravada sem fuso.
 *
 * Prisma sempre serializa `Date` como UTC ao escrever em `timestamp`. Para o
 * caso (1) isso já coincide com o legado. Para o caso (2) precisamos gravar um
 * `Date` cujos componentes UTC sejam iguais aos componentes de parede em São
 * Paulo — a técnica de "UTC fictício" implementada aqui.
 *
 * Todo cálculo mensal/semestral do banco de horas usa fronteiras de mês em hora
 * de parede (o legado faz `datetime(ano, mes, 1)` local), portanto as funções de
 * fronteira também operam no espaço de parede.
 */

export const LEGACY_TIMEZONE = 'America/Sao_Paulo';

/**
 * Componentes de uma data/hora de parede, sem fuso.
 * Corresponde 1:1 a um `datetime` naive do Python.
 */
export interface WallClockParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

const ISO_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?$/;

/**
 * Converte componentes de parede no `Date` que deve ser gravado na coluna
 * naive — isto é, um instante cujos getters UTC devolvem esses componentes.
 */
export function wallClockToStorage(parts: WallClockParts): Date {
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond,
    ),
  );
}

/** Inverso de `wallClockToStorage`: lê os componentes de parede de um valor armazenado. */
export function storageToWallClock(stored: Date): WallClockParts {
  return {
    year: stored.getUTCFullYear(),
    month: stored.getUTCMonth() + 1,
    day: stored.getUTCDate(),
    hour: stored.getUTCHours(),
    minute: stored.getUTCMinutes(),
    second: stored.getUTCSeconds(),
    millisecond: stored.getUTCMilliseconds(),
  };
}

/**
 * Interpreta a entrada da API como hora de parede de São Paulo.
 *
 * Aceita:
 *   - `2026-03-10T08:30` e `2026-03-10T08:30:00` (sem fuso) — tomados como parede;
 *   - `2026-03-10T08:30:00-03:00` / `...Z` (com fuso) — convertidos para a
 *     parede equivalente em São Paulo.
 *
 * Devolve o `Date` pronto para gravar na coluna naive.
 */
export function parseWallClockInput(raw: string): Date {
  const value = raw.trim();
  if (!value) {
    throw new RangeError('Data/hora vazia.');
  }

  const local = ISO_LOCAL_PATTERN.exec(value);
  if (local) {
    const parts: WallClockParts = {
      year: Number(local[1]),
      month: Number(local[2]),
      day: Number(local[3]),
      hour: Number(local[4]),
      minute: Number(local[5]),
      second: Number(local[6] ?? 0),
      millisecond: Number((local[7] ?? '0').padEnd(3, '0')),
    };
    const stored = wallClockToStorage(parts);
    // Rejeita datas impossíveis como 2026-02-30, que o Date normalizaria em silêncio.
    const roundTrip = storageToWallClock(stored);
    if (
      roundTrip.year !== parts.year ||
      roundTrip.month !== parts.month ||
      roundTrip.day !== parts.day ||
      roundTrip.hour !== parts.hour ||
      roundTrip.minute !== parts.minute
    ) {
      throw new RangeError(`Data/hora inexistente: "${raw}".`);
    }
    return stored;
  }

  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`Data/hora inválida: "${raw}".`);
  }
  return instantToWallClockStorage(instant);
}

/** Converte um instante absoluto na parede de São Paulo pronta para armazenamento. */
export function instantToWallClockStorage(instant: Date): Date {
  return wallClockToStorage(instantToWallClockParts(instant));
}

const WALL_CLOCK_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: LEGACY_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** Componentes de parede de São Paulo para um instante absoluto. */
export function instantToWallClockParts(instant: Date): WallClockParts {
  const fields = new Map(
    WALL_CLOCK_FORMATTER.formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value] as const),
  );

  const hour = Number(fields.get('hour'));
  return {
    year: Number(fields.get('year')),
    month: Number(fields.get('month')),
    day: Number(fields.get('day')),
    // Intl pode devolver 24 para meia-noite em hour12:false.
    hour: hour === 24 ? 0 : hour,
    minute: Number(fields.get('minute')),
    second: Number(fields.get('second')),
    millisecond: instant.getUTCMilliseconds(),
  };
}

/** "Agora" na parede de São Paulo, pronto para comparar com valores armazenados. */
export function nowWallClock(now: Date = new Date()): Date {
  return instantToWallClockStorage(now);
}

/** Serializa um valor armazenado no formato ISO local usado pela API (sem fuso). */
export function formatWallClockIso(stored: Date): string {
  const p = storageToWallClock(stored);
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return (
    `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}` +
    `T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`
  );
}

/** Formata no padrão pt-BR usado pelo legado nos e-mails e PDFs: dd/mm/aaaa HH:MM. */
export function formatWallClockPtBr(stored: Date): string {
  const p = storageToWallClock(stored);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(p.hour)}:${pad(p.minute)}`;
}

// ---------------------------------------------------------------------------
// Fronteiras de período (espaço de parede) — equivalentes ao legado
// ---------------------------------------------------------------------------

/** `month_period_bounds` do legado: [início do mês, início do mês seguinte). */
export function monthPeriodBounds(year: number, month: number): [Date, Date] {
  const start = wallClockToStorage({
    year,
    month,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = wallClockToStorage({
    year: nextYear,
    month: nextMonth,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  return [start, end];
}

/**
 * Janela móvel de `days` dias CORRIDOS terminando agora.
 *
 * O início é ancorado à meia-noite, não ao horário exato de N dias atrás: com
 * "últimos 30 dias" a pessoa espera 30 caixinhas de dia inteiro no gráfico, e
 * uma janela que começasse às 14h37 de 30 dias atrás produziria 31, sendo a
 * primeira e a última pela metade. Hoje conta como um dos N dias.
 *
 * `now` precisa vir no MESMO espaço em que as datas serão comparadas — tanto em
 * `analytics` quanto em `tickets` isso é o espaço de parede de
 * `instantToWallClockStorage`, o mesmo de `monthPeriodBounds`.
 */
export function lastDaysBounds(now: Date, days: number): [Date, Date] {
  const parts = storageToWallClock(now);
  const startOfToday = wallClockToStorage({
    ...parts,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const start = new Date(startOfToday.getTime() - (days - 1) * 86_400_000);
  return [start, now];
}

/** Início do mês seguinte ao de um valor armazenado. Usado para fatiar por mês. */
export function startOfNextMonth(stored: Date): Date {
  const { year, month } = storageToWallClock(stored);
  return monthPeriodBounds(year, month)[1];
}

/** Último dia do mês, como `calendar.monthrange` do legado. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * `add_months` do legado: soma meses preservando o dia quando possível e
 * truncando para o último dia do mês de destino quando necessário.
 */
export function addMonths(stored: Date, months: number): Date {
  const parts = storageToWallClock(stored);
  const monthIndex = parts.month - 1 + months;
  const targetYear = parts.year + Math.floor(monthIndex / 12);
  const targetMonth = (((monthIndex % 12) + 12) % 12) + 1;
  const targetDay = Math.min(parts.day, daysInMonth(targetYear, targetMonth));
  return wallClockToStorage({
    ...parts,
    year: targetYear,
    month: targetMonth,
    day: targetDay,
  });
}

/** Diferença em horas entre dois valores armazenados, nunca negativa. */
export function durationHours(start: Date, end: Date): number {
  return Math.max((end.getTime() - start.getTime()) / 3_600_000, 0);
}
