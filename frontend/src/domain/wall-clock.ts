// Hora de parede (Fase 09).
//
// O backend grava DOIS significados diferentes no mesmo tipo de coluna:
//
//   `ticket.createdAt`        → instante UTC, ISO com fuso
//   `activity.startedAt/EndedAt` → hora de PAREDE de America/Sao_Paulo,
//                                  ISO **sem** fuso (`2026-03-10T08:30:00`)
//
// Para atividades, o valor é literalmente o que o usuário digitou no
// `<input type="datetime-local">` do legado. Passar isso por `new Date(...)`
// e `toISOString()` aplicaria o fuso do aparelho e deslocaria o horário em 3
// horas — silenciosamente, e só na gravação. Por isso tudo aqui é manipulação
// de STRING e de componentes, nunca conversão de fuso.
//
// Regra prática: se o campo é de atividade, ele nunca vira `Date` no caminho
// de ida. `Date` só aparece para ler os componentes locais do relógio.

/** Componentes de um instante de parede. `month` é 1..12. */
export interface WallClockParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const WALL_CLOCK_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Lê `2026-03-10T08:30` ou `2026-03-10T08:30:00` (com ou sem segundos) sem
 * envolver fuso. Devolve `null` para entrada malformada ou data inexistente.
 */
export function parseWallClock(value: string): WallClockParts | null {
  const match = WALL_CLOCK_PATTERN.exec(value.trim())
  if (!match) return null

  const parts: WallClockParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  }

  if (parts.month < 1 || parts.month > 12) return null
  if (parts.hour > 23 || parts.minute > 59) return null
  // 31 de fevereiro é sintaticamente válido e semanticamente não.
  if (parts.day < 1 || parts.day > daysInMonth(parts.year, parts.month)) return null

  return parts
}

export function daysInMonth(year: number, month: number): number {
  // Dia 0 do mês seguinte é o último dia deste. `Date.UTC` evita que o fuso do
  // aparelho empurre a data para o mês vizinho.
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Serializa no formato que a API espera: `YYYY-MM-DDTHH:mm`, sem fuso. */
export function formatWallClockForApi(parts: WallClockParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}

/** `dd/mm/aaaa HH:MM`, o formato de exibição do legado. */
export function formatWallClockLabel(value: string): string {
  const parts = parseWallClock(value)
  if (!parts) return value
  return `${pad(parts.day)}/${pad(parts.month)}/${parts.year} ${pad(parts.hour)}:${pad(parts.minute)}`
}

/**
 * Agora, em hora de parede local. Usa os componentes LOCAIS do relógio — que é
 * o que o `datetime-local` do navegador mostraria — e nunca `toISOString()`.
 */
export function nowWallClock(now: Date = new Date()): string {
  return formatWallClockForApi({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
  })
}

const BR_LABEL_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/

/**
 * Lê o formato que o usuário digita (`dd/mm/aaaa HH:MM`) e devolve os
 * componentes. Também sem fuso — é a mesma hora de parede, só escrita na ordem
 * brasileira.
 */
export function parseBrLabel(value: string): WallClockParts | null {
  const match = BR_LABEL_PATTERN.exec(value.trim())
  if (!match) return null

  return parseWallClock(`${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}`)
}

/**
 * Aplica a máscara `dd/mm/aaaa HH:MM` conforme se digita, preservando apenas
 * dígitos. Recebe o texto cru do campo e devolve o texto formatado.
 */
export function maskBrDateTime(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 12)

  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)
  const hour = digits.slice(8, 10)
  const minute = digits.slice(10, 12)

  let result = day
  if (month) result += `/${month}`
  if (year) result += `/${year}`
  if (hour) result += ` ${hour}`
  if (minute) result += `:${minute}`
  return result
}

/** Minutos desde o ano 0, só para ordenar e comparar dois instantes de parede. */
function toComparableMinutes(parts: WallClockParts): number {
  // Comparação puramente aritmética entre componentes: sem fuso, sem horário
  // de verão, sem `Date`.
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) / 60000
}

export interface PeriodValidation {
  ok: boolean
  /** Mensagem pronta para exibir; `null` quando válido. */
  error: string | null
}

/**
 * Valida o par início/fim com as mesmas mensagens do legado.
 *
 * O legado exige fim **estritamente** depois do início: duração zero não é
 * atividade. Adjacência entre atividades distintas, por outro lado, é
 * permitida (o conflito é checado no servidor).
 */
export function validateActivityPeriod(startedAt: string, endedAt: string): PeriodValidation {
  const start = parseWallClock(startedAt)
  const end = parseWallClock(endedAt)

  if (!start || !end) {
    return { ok: false, error: 'Datas inválidas. Use data e hora válidas.' }
  }

  if (toComparableMinutes(end) <= toComparableMinutes(start)) {
    return { ok: false, error: 'A hora de término deve ser posterior à de início.' }
  }

  return { ok: true, error: null }
}

/** Duração em horas com 2 casas, como a API calcula. */
export function durationInHours(startedAt: string, endedAt: string): number | null {
  const start = parseWallClock(startedAt)
  const end = parseWallClock(endedAt)
  if (!start || !end) return null

  const minutes = toComparableMinutes(end) - toComparableMinutes(start)
  return Math.round((minutes / 60) * 100) / 100
}

// ---------------------------------------------------------------------------
// Instantes UTC (chamados) — categoria diferente, tratamento diferente
// ---------------------------------------------------------------------------

/**
 * `ticket.createdAt` é instante UTC de verdade, então aqui a conversão para o
 * fuso do aparelho é o comportamento CORRETO — ao contrário das atividades.
 */
export function formatInstantLabel(isoInstant: string): string {
  const date = new Date(isoInstant)
  if (Number.isNaN(date.getTime())) return isoInstant
  return (
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}
