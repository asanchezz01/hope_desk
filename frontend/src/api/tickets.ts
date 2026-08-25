// Endpoints de chamados (Fase 09). Tipos espelham `ticket.dto.ts` do backend.
import { request } from './client'

export type TicketStatus = 'aberto' | 'em_andamento' | 'resolvido' | 'fechado'

/** Filtros do dashboard do legado. `nao_concluidos` exclui resolvido e fechado. */
export const TICKET_STATUS_FILTERS = [
  'nao_concluidos',
  'all',
  'aberto',
  'em_andamento',
  'resolvido',
  'fechado',
] as const

export type TicketStatusFilter = (typeof TICKET_STATUS_FILTERS)[number]

export const TICKET_STATUS_FILTER_LABELS: Record<TicketStatusFilter, string> = {
  nao_concluidos: 'Não concluídos',
  all: 'Todos',
  aberto: 'Em aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Concluído',
  fechado: 'Fechado',
}

export interface TicketParty {
  id: number
  name: string
  email: string
}

export interface TicketModule {
  id: number
  name: string
  isActive: boolean
}

export interface Ticket {
  id: number
  title: string
  description: string
  status: TicketStatus
  statusLabel: string
  /** Instante UTC, ISO 8601 — diferente das atividades, que são hora de parede. */
  createdAt: string
  client: TicketParty
  technician: TicketParty | null
  systemModule: TicketModule | null
  activityCount: number
  /** Soma das horas das atividades do chamado (legado: `total_hours`). */
  totalHours: number
}

export interface PaginatedTickets {
  items: Ticket[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  appliedFilters: {
    year: number | null
    month: number | null
    status: string
    search: string | null
  }
  /** Totais de horas do recorte, no cartão do dashboard do legado. */
  summary: {
    /** Somas de horas dos chamados criados no período, todo status. */
    periodTotalHours: number
    /** Soma de horas dos chamados da lista filtrada, todas as páginas. */
    gridTotalHours: number
  }
}

export interface ListTicketsParams {
  year?: number
  month?: number
  /** Janela móvel de N dias corridos terminando hoje. Vence ano/mês/allPeriods. */
  lastDays?: number
  status?: TicketStatusFilter
  /** Ignora o período e busca em todo o histórico. */
  allPeriods?: boolean
  /** ID exato ou trecho do título. */
  search?: string
  page?: number
  pageSize?: number
}

function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    // `undefined` e string vazia significam "não filtrar"; enviá-los faria a
    // API aplicar o default em vez de omitir o filtro.
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export interface CreateTicketInput {
  title: string
  description: string
  systemModuleId: number
  /** Ignorado quando quem abre é o próprio cliente. */
  clientId?: number
  technicianId?: number
}

export interface UpdateTicketInput {
  title: string
  description: string
  status: TicketStatus
  clientId: number
  systemModuleId: number
  /** `null` desatribui o técnico. */
  technicianId?: number | null
}

export const ticketsApi = {
  list: (params: ListTicketsParams = {}) =>
    request<PaginatedTickets>(`/tickets${toQueryString({ ...params })}`),

  availableYears: () => request<number[]>('/tickets/available-years'),

  findOne: (id: number) => request<Ticket>(`/tickets/${id}`),

  create: (input: CreateTicketInput) =>
    request<Ticket>('/tickets', { method: 'POST', body: input }),

  update: (id: number, input: UpdateTicketInput) =>
    request<Ticket>(`/tickets/${id}`, { method: 'PATCH', body: input }),

  changeStatus: (id: number, status: TicketStatus) =>
    request<Ticket>(`/tickets/${id}/status`, { method: 'POST', body: { status } }),

  remove: (id: number) => request<void>(`/tickets/${id}`, { method: 'DELETE' }),
}
