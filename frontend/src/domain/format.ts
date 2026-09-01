// Formatação pt-BR.
//
// `Intl.NumberFormat` não é usado aqui: o Hermes pode ser compilado sem dados
// completos de ICU, e o resultado varia por plataforma. Estas funções produzem
// sempre a mesma saída em Android, iOS e Web — e as horas e valores monetários
// que vêm da API já chegam formatados no campo `formatted`, que deve ter
// preferência quando existir.

function withThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Inteiro com separador de milhar: `1234` → `1.234`. */
export function formatInteger(value: number): string {
  const rounded = Math.round(value)
  const negative = rounded < 0
  return (negative ? '-' : '') + withThousands(String(Math.abs(rounded)))
}

/** Decimal com vírgula: `2.5` → `2,50`. */
export function formatDecimal(value: number, digits = 2): string {
  const negative = value < 0
  const fixed = Math.abs(value).toFixed(digits)
  const [intPart, fraction] = fixed.split('.')
  const body = fraction ? `${withThousands(intPart)},${fraction}` : withThousands(intPart)
  return (negative ? '-' : '') + body
}

/** Horas com sufixo: `2.25` → `2,25 h`. */
export function formatHours(value: number): string {
  return `${formatDecimal(value)} h`
}

/** Percentual inteiro, para rótulos de participação. */
export function formatPercent(part: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

/** `2026-08-14` → `14/08/2026`. Datas puras da API (sem hora, sem fuso). */
export function formatIsoDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!match) return isoDate
  return `${match[3]}/${match[2]}/${match[1]}`
}

/** Máscara `dd/mm/aaaa` conforme se digita, preservando só os dígitos. */
export function maskBrDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)

  let result = day
  if (month) result += `/${month}`
  if (year) result += `/${year}`
  return result
}

/**
 * Aplica a máscara só quando se digita NO FIM do campo.
 *
 * Máscaras posicionais reconstroem o texto a partir da sequência de dígitos.
 * Isso funciona enquanto se acrescenta ao final, mas embaralha qualquer edição
 * no meio — trocar `14:23` por `10:23` num campo já preenchido reescrevia o
 * valor e ainda jogava o cursor para o fim, o que na prática impedia digitar o
 * horário. Fora do caso "acrescentou ao final", o texto passa como veio e a
 * validação fica por conta de quem for interpretá-lo.
 */
export function maskOnAppend(
  previous: string,
  raw: string,
  mask: (raw: string) => string,
): string {
  const clean = raw.replace(/[^\d/: ]/g, '')
  const appended = clean.length > previous.length && clean.startsWith(previous)
  return appended ? mask(clean) : clean
}

/**
 * `dd/mm/aaaa` → `AAAA-MM-DD`, ou `null` se incompleto/inválido.
 *
 * As datas de relatório e de pagamento são DATAS PURAS: sem hora e sem fuso.
 * Passá-las por `Date` e `toISOString()` pode recuar um dia em fusos negativos
 * — é o mesmo cuidado que a API toma com `paid_at`.
 */
export function parseBrDateToIso(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (month < 1 || month > 12) return null

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day < 1 || day > lastDay) return null

  return `${match[3]}-${match[2]}-${match[1]}`
}

/** Hoje em `AAAA-MM-DD`, pelo relógio local. */
export function todayIsoDate(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Primeiro dia do mês corrente em `AAAA-MM-DD`. */
export function firstDayOfMonthIso(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
}

/**
 * Primeiro dia de uma janela de `days` dias corridos terminando HOJE, em
 * `AAAA-MM-DD`. Hoje conta como um dos dias — "últimos 30 dias" com hoje em
 * 25/08 começa em 27/07, e não em 26/07.
 *
 * A conta usa meio-dia como âncora: somar dias direto sobre a meia-noite
 * escorrega uma hora na virada do horário de verão, e a data volta errada.
 */
export function isoDaysAgo(days: number, now: Date = new Date()): string {
  const anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  anchor.setDate(anchor.getDate() - (days - 1))
  return todayIsoDate(anchor)
}
