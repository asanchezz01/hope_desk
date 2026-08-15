// Endpoints de atividades (Fase 09). Rotas aninhadas em /tickets/:ticketId.
//
// `startedAt` e `endedAt` são hora de PAREDE, ISO sem fuso. Ver
// `src/domain/wall-clock.ts` — nunca converta esses campos com `Date`.
import { request } from './client'

export interface ActivityAuthor {
  id: number
  name: string
}

export interface Activity {
  id: number
  ticketId: number
  notes: string
  /** Hora de parede, ISO local sem fuso (`2026-03-10T08:30:00`). */
  startedAt: string
  endedAt: string
  /** Já formatados em pt-BR pela API — prefira-os a reformatar no cliente. */
  startedLabel: string
  endedLabel: string
  durationHours: number
  createdBy: ActivityAuthor
  /**
   * Dicas de UI vindas do servidor. Aqui elas EXISTEM (diferente de chamados),
   * porque a regra de edição depende da autoria: nem superuser edita atividade
   * lançada por outro técnico.
   */
  canEdit: boolean
  canDelete: boolean
}

export interface ActivityList {
  items: Activity[]
  totalHours: number
}

export interface ActivityInput {
  notes: string
  /** `YYYY-MM-DDTHH:mm`, hora de parede. */
  startedAt: string
  endedAt: string
}

export const activitiesApi = {
  list: (ticketId: number) => request<ActivityList>(`/tickets/${ticketId}/activities`),

  create: (ticketId: number, input: ActivityInput) =>
    request<Activity>(`/tickets/${ticketId}/activities`, { method: 'POST', body: input }),

  update: (ticketId: number, id: number, input: ActivityInput) =>
    request<Activity>(`/tickets/${ticketId}/activities/${id}`, {
      method: 'PATCH',
      body: input,
    }),

  remove: (ticketId: number, id: number) =>
    request<void>(`/tickets/${ticketId}/activities/${id}`, { method: 'DELETE' }),
}
