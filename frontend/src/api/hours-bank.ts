// Banco de horas (Fase 11). O resumo mensal alimenta o cartão do dashboard do
// legado: horas de atividades "estrangeiras" e horas pagas no mês.
import { request } from './client'

/** Espelha `MonthlyHoursSummaryResponse` do backend. */
export interface MonthlyHoursSummary {
  year: number
  month: number
  /** Horas de atividades recortadas no mês. */
  periodActivityHours: number
  /** Horas de atividades do mês ligadas a chamados criados em OUTROS meses. */
  externalTicketActivityHours: number
  /** Horas pagas no mês (limite superior exclusivo, como no legado). */
  paidHoursInMonth: number
}

export interface MonthlyHoursSummaryParams {
  year?: number
  month?: number
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

export const hoursBankApi = {
  monthlySummary: (params: MonthlyHoursSummaryParams = {}) =>
    request<MonthlyHoursSummary>(`/hours-bank/monthly-summary${toQueryString({ ...params })}`),
}
