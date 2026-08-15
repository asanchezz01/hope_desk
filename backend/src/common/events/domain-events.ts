/**
 * Eventos de domínio.
 *
 * A Fase 04 apenas **emite** os eventos; nenhum e-mail é enviado. A Fase 07
 * registra os handlers de notificação, preservando as regras de destinatários do
 * legado (ver docs/LEGACY_CONTRACTS.md §12).
 *
 * O payload carrega tudo que um handler precisa para montar a notificação sem
 * voltar ao banco, porque o handler roda depois da transação principal.
 */

export const TICKET_CREATED = 'ticket.created' as const;
export const TICKET_STATUS_CHANGED = 'ticket.status-changed' as const;
export const ACTIVITY_CREATED = 'activity.created' as const;
export const PASSWORD_RESET_REQUESTED = 'password.reset-requested' as const;

export interface TicketCreatedEvent {
  ticketId: number;
  title: string;
  description: string;
  clientId: number;
  clientName: string;
  clientEmail: string;
  /** Técnico designado na criação, se houver. Define os destinatários (§12). */
  technicianId: number | null;
}

export interface TicketStatusChangedEvent {
  ticketId: number;
  title: string;
  previousStatus: string;
  newStatus: string;
  clientId: number;
  clientName: string;
  clientEmail: string;
}

export interface ActivityCreatedEvent {
  activityId: number;
  ticketId: number;
  ticketTitle: string;
  notes: string;
  /** Hora de parede armazenada; formatar com `formatWallClockPtBr`. */
  startedAt: Date;
  endedAt: Date;
  technicianId: number;
  technicianName: string;
  clientId: number;
  clientName: string;
  clientEmail: string;
}

export interface PasswordResetRequestedEvent {
  userId: number;
  name: string;
  email: string;
  /** Token em claro. Nunca registrar em log nem persistir. */
  token: string;
  expiresAt: Date;
}

/** Mapa nome do evento → payload, para publicação e assinatura tipadas. */
export interface DomainEventMap {
  [TICKET_CREATED]: TicketCreatedEvent;
  [TICKET_STATUS_CHANGED]: TicketStatusChangedEvent;
  [ACTIVITY_CREATED]: ActivityCreatedEvent;
  [PASSWORD_RESET_REQUESTED]: PasswordResetRequestedEvent;
}

export type DomainEventName = keyof DomainEventMap;
