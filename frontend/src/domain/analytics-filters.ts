// Filtro cruzado do Painel de Indicadores.
//
// O legado fazia isto no `<script>` do `analytics.html`: clicar numa fatia,
// numa barra ou numa coluna recortava o painel INTEIRO por aquela dimensão.
// Era o que tornava o painel navegável em vez de decorativo — e era a maior
// coisa que faltava na tela nova.
//
// A regra que não é óbvia é o `skipDim`. Ao recalcular um gráfico, a dimensão
// DELE não se filtra a si mesma: o gráfico de módulos com "Financeiro" ativo
// continua mostrando os outros módulos, senão sobraria uma barra só e não
// haveria como trocar de módulo sem antes limpar o filtro. Todos os OUTROS
// gráficos, esses sim, já vêm recortados.
//
// Tudo aqui é função pura sobre as linhas que a API já devolve
// (`tickets`, `activities`) — não há requisição nova a cada clique, exatamente
// como no legado.
import type { AnalyticsActivityRow, AnalyticsTicketRow } from '../api/analytics'

export const FILTER_DIMENSIONS = ['status', 'module', 'tech', 'client', 'bucket'] as const

export type FilterDimension = (typeof FILTER_DIMENSIONS)[number]

export type AnalyticsFilters = Record<FilterDimension, string | null>

export const NO_FILTERS: AnalyticsFilters = {
  status: null,
  module: null,
  tech: null,
  client: null,
  bucket: null,
}

/** Clicar no valor já ativo desliga o filtro — o clique é um interruptor. */
export function toggleFilter(
  filters: AnalyticsFilters,
  dimension: FilterDimension,
  value: string
): AnalyticsFilters {
  return { ...filters, [dimension]: filters[dimension] === value ? null : value }
}

export interface ActiveFilter {
  dimension: FilterDimension
  value: string
}

/** Filtros ligados, na ordem fixa das dimensões — nunca na ordem do clique. */
export function activeFilters(filters: AnalyticsFilters): ActiveFilter[] {
  return FILTER_DIMENSIONS.filter((dimension) => filters[dimension] !== null).map((dimension) => ({
    dimension,
    value: filters[dimension] as string,
  }))
}

export function hasAnyFilter(filters: AnalyticsFilters): boolean {
  return activeFilters(filters).length > 0
}

export function ticketMatches(
  ticket: AnalyticsTicketRow,
  filters: AnalyticsFilters,
  skip?: FilterDimension
): boolean {
  if (skip !== 'status' && filters.status && ticket.status !== filters.status) return false
  if (skip !== 'module' && filters.module && ticket.module !== filters.module) return false
  // Um chamado com vários técnicos entra no recorte de QUALQUER um deles.
  if (skip !== 'tech' && filters.tech && !ticket.technicians.includes(filters.tech)) return false
  if (skip !== 'client' && filters.client && ticket.client !== filters.client) return false
  if (skip !== 'bucket' && filters.bucket && ticket.bucket !== filters.bucket) return false
  return true
}

export function activityMatches(
  activity: AnalyticsActivityRow,
  filters: AnalyticsFilters,
  skip?: FilterDimension
): boolean {
  if (skip !== 'status' && filters.status && activity.status !== filters.status) return false
  if (skip !== 'module' && filters.module && activity.module !== filters.module) return false
  if (skip !== 'tech' && filters.tech && activity.technician !== filters.tech) return false
  if (skip !== 'client' && filters.client && activity.client !== filters.client) return false
  if (skip !== 'bucket' && filters.bucket && activity.bucket !== filters.bucket) return false
  return true
}

export function filterTickets(
  tickets: AnalyticsTicketRow[],
  filters: AnalyticsFilters,
  skip?: FilterDimension
): AnalyticsTicketRow[] {
  return tickets.filter((ticket) => ticketMatches(ticket, filters, skip))
}

export function filterActivities(
  activities: AnalyticsActivityRow[],
  filters: AnalyticsFilters,
  skip?: FilterDimension
): AnalyticsActivityRow[] {
  return activities.filter((activity) => activityMatches(activity, filters, skip))
}

/** Contagem por chave, preservando a ordem de primeira aparição. */
export function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const totals = new Map<string, number>()
  for (const item of items) {
    const value = key(item)
    totals.set(value, (totals.get(value) ?? 0) + 1)
  }
  return totals
}

/** Soma de horas por chave, preservando a ordem de primeira aparição. */
export function sumBy<T>(items: T[], key: (item: T) => string, amount: (item: T) => number) {
  const totals = new Map<string, number>()
  for (const item of items) {
    const value = key(item)
    totals.set(value, (totals.get(value) ?? 0) + amount(item))
  }
  return totals
}

/**
 * Categorias fixas, tiradas do conjunto COMPLETO e ordenadas por grandeza.
 *
 * O eixo não pode reordenar quando um filtro liga: quem clicou em "Financeiro"
 * espera que a barra continue onde estava. Recalcular a ordem a cada filtro é o
 * mesmo defeito do recolorir-ao-filtrar — o leitor perde a referência que
 * acabou de usar.
 */
export function fixedCategories<T>(
  items: T[],
  key: (item: T) => string,
  weight: (item: T) => number,
  limit?: number
): string[] {
  const totals = sumBy(items, key, weight)
  const ordered = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value)
  return limit === undefined ? ordered : ordered.slice(0, limit)
}

export interface CrossKpis {
  totalTickets: number
  concludedTickets: number
  pendingTickets: number
  totalHours: number
  hoursPerTicket: number | null
  averageFirstResponseHours: number | null
  averageOpenAgeDays: number | null
}

const CONCLUDED = new Set(['resolvido', 'fechado'])

/**
 * Os indicadores recalculados sobre o recorte corrente.
 *
 * O legado refazia estas contas no navegador a cada clique, e é por isso que os
 * KPIs no topo respondiam ao filtro. Manter a mesma conta é o que faz os
 * números baterem com os que a operação já conhece.
 */
export function crossKpis(
  tickets: AnalyticsTicketRow[],
  activities: AnalyticsActivityRow[]
): CrossKpis {
  const concluded = tickets.filter((ticket) => CONCLUDED.has(ticket.status)).length
  const totalHours = activities.reduce((total, activity) => total + activity.hours, 0)

  const responses = tickets
    .map((ticket) => ticket.responseHours)
    .filter((value): value is number => value !== null)

  // `ageDays` é nulo em chamado concluído. Tratar nulo como zero puxaria a
  // média para baixo a cada chamado fechado — o oposto do que o indicador diz.
  const ages = tickets
    .map((ticket) => ticket.ageDays)
    .filter((value): value is number => value !== null)

  const mean = (values: number[]) =>
    values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length

  return {
    totalTickets: tickets.length,
    concludedTickets: concluded,
    pendingTickets: tickets.length - concluded,
    totalHours,
    hoursPerTicket: tickets.length === 0 ? null : totalHours / tickets.length,
    averageFirstResponseHours: mean(responses),
    averageOpenAgeDays: mean(ages),
  }
}
