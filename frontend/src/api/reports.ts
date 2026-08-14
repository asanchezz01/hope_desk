// Relatórios (Fase 10). Cada um tem versão JSON, para a tela, e PDF, para
// download — a URL do PDF exige `Authorization`, então vem por `requestBlob`.
import { request, requestBlob } from './client'

export interface ReportCompanyHeader {
  companyName: string
  companyAddress: string
  companyLogo: string
}

export interface ActivityReportActivityRow {
  startedAt: string
  endedAt: string
  /** Recorte da atividade dentro do intervalo pedido; pode ser menor que o total. */
  periodStartedAt: string
  periodEndedAt: string
  startedLabel: string
  endedLabel: string
  technicianName: string
  notes: string
  hours: number
}

export interface ActivityReportTicketRow {
  ticketId: number
  title: string
  description: string
  status: string
  clientName: string
  assignedTechnician: string
  moduleName: string
  createdAt: string
  createdLabel: string
  totalHours: number
  activities: ActivityReportActivityRow[]
}

export interface TechnicianTotal {
  technicianName: string
  hours: number
}

export interface ActivityReport {
  periodStart: string
  periodEnd: string
  periodStartLabel: string
  periodEndLabel: string
  company: ReportCompanyHeader
  tickets: ActivityReportTicketRow[]
  totalsByTechnician: TechnicianTotal[]
  totalHours: number
}

export interface ServicesReportRow {
  ticketId: number
  lastActivityAt: string
  lastActivityLabel: string
  title: string
  service: string
  status: string
  clientName: string
  technicianName: string
  hours: number
}

export interface ServicesReport {
  year: number
  month: number
  periodLabel: string
  company: ReportCompanyHeader
  rows: ServicesReportRow[]
  totalHours: number
}

/** Intervalo em `AAAA-MM-DD`. A data final é INCLUSIVA. */
export interface ActivityReportParams {
  start?: string
  end?: string
}

export interface ServicesReportParams {
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

export const reportsApi = {
  activities: (params: ActivityReportParams = {}) =>
    request<ActivityReport>(`/reports/activities${toQueryString({ ...params })}`),

  activitiesPdf: (params: ActivityReportParams = {}) =>
    requestBlob(`/reports/activities.pdf${toQueryString({ ...params })}`),

  services: (params: ServicesReportParams = {}) =>
    request<ServicesReport>(`/reports/services${toQueryString({ ...params })}`),

  servicesPdf: (params: ServicesReportParams = {}) =>
    requestBlob(`/reports/services.pdf${toQueryString({ ...params })}`),
}
