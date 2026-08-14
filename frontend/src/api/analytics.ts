// Painel de indicadores (Fase 10). Espelha `analytics.dto.ts`.
import { request } from './client'

export interface AnalyticsBucket {
  key: string
  label: string
}

export interface CountByKey {
  key: string
  label: string
  count: number
  hours: number
}

export interface AnalyticsKpis {
  totalTickets: number
  concludedTickets: number
  openTickets: number
  totalHours: number
  averageHoursPerTicket: number
  /**
   * ATENÇÃO: este indicador sai ~3h MENOR que o tempo real. O legado subtrai
   * `activity.started_at` (hora de parede) de `ticket.created_at` (instante
   * UTC), misturando os dois espaços temporais. É preservado por paridade —
   * ver `LEGACY_CONTRACTS.md` §13.2 e o item 14 dos riscos. Não "corrija" na
   * tela: a operação já usa esse número como referência.
   */
  averageFirstResponseHours: number | null
  ticketsWithActivity: number
}

export interface AnalyticsBacklog {
  total: number
  oldestDays: number
  oldestTicketId: number | null
}

export interface AnalyticsTrendPoint {
  label: string
  year: number
  month: number
  tickets: number
  hours: number
}

export interface AnalyticsResponse {
  periodLabel: string
  bucketMode: 'day' | 'month'
  buckets: AnalyticsBucket[]
  selectedYear: number | null
  selectedMonth: number | null
  availableYears: number[]
  kpis: AnalyticsKpis
  backlog: AnalyticsBacklog
  byStatus: CountByKey[]
  byModule: CountByKey[]
  byTechnician: CountByKey[]
  byClient: CountByKey[]
  trend: AnalyticsTrendPoint[]
  hoursByBucket: Record<string, number>
  ticketsByBucket: Record<string, number>
  accumulatedHours: number
  monthlyHoursAllowance: number
  paidHoursInPeriod: number
  cycleStartLabel: string
  cycleEndLabel: string
  /** Rótulos e cores canônicas do legado, as mesmas de `ticket-status.ts`. */
  statusMeta: Record<string, { label: string; color: string }>
}

export interface AnalyticsParams {
  year?: number
  month?: number
  allPeriods?: boolean
}

function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const analyticsApi = {
  get: (params: AnalyticsParams = {}) =>
    request<AnalyticsResponse>(`/analytics${toQueryString({ ...params })}`),
}
