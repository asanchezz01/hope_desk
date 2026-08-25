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

/**
 * Uma linha da tabela "Chamados do período" do legado.
 *
 * A API sempre devolveu estas linhas — é assim que o legado alimentava a
 * tabela e os filtros cruzados da página, sem novo request. O cliente só não
 * as declarava, e por isso a tela ignorava metade do que recebia.
 */
export interface AnalyticsTicketRow {
  id: number
  title: string
  status: string
  statusLabel: string
  module: string
  client: string
  technician: string
  technicians: string[]
  bucket: string
  createdAt: string
  createdLabel: string
  hours: number
  responseHours: number | null
  /** Idade em dias; `null` para chamados já concluídos. */
  ageDays: number | null
}

export interface AnalyticsActivityRow {
  ticketId: number
  bucket: string
  technician: string
  hours: number
  status: string
  module: string
  client: string
}

export interface AnalyticsResponse {
  periodLabel: string
  /** 'day' = dia do mês (visão mensal); 'date' = aaaa-mm-dd (janela móvel). */
  bucketMode: 'day' | 'date' | 'month'
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
  /** Chamados do período, linha a linha (tabela do legado). */
  tickets: AnalyticsTicketRow[]
  /** Atividades do período, para o gráfico por dia/mês. */
  activities: AnalyticsActivityRow[]
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
  /** Janela móvel de N dias corridos terminando hoje. Vence ano/mês/allPeriods. */
  lastDays?: number
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
