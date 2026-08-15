/**
 * Ações auditadas (Fase 11).
 *
 * A lista é fechada de propósito: uma string livre em cada chamada acabaria em
 * `user.delete`, `user.deleted` e `userDeleted` convivendo, e a trilha ficaria
 * impossível de consultar. Acrescentar uma ação exige acrescentar aqui.
 *
 * O critério do que auditar é: mudanças de PRIVILÉGIO, de DINHEIRO, e
 * EXCLUSÕES. Leitura não entra — encheria a tabela sem responder a nenhuma
 * pergunta que a operação faça de verdade.
 */
export const AUDIT_ACTIONS = {
  // Autenticação
  LOGIN_SUCCEEDED: 'auth.login_succeeded',
  LOGIN_FAILED: 'auth.login_failed',
  PASSWORD_CHANGED: 'auth.password_changed',
  PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'auth.password_reset_completed',
  REFRESH_REUSE_DETECTED: 'auth.refresh_reuse_detected',
  LOGOUT_ALL: 'auth.logout_all',

  // Usuários e privilégio
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_ROLE_CHANGED: 'user.role_changed',
  USER_SUPERUSER_CHANGED: 'user.superuser_changed',

  // Configuração
  MODULE_CREATED: 'system_module.created',
  MODULE_UPDATED: 'system_module.updated',
  MODULE_TOGGLED: 'system_module.toggled',
  MODULE_DELETED: 'system_module.deleted',
  PARAMETERS_UPDATED: 'parameters.updated',

  // Dinheiro
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_DELETED: 'payment.deleted',

  // Exclusões de domínio
  TICKET_DELETED: 'ticket.deleted',
  ACTIVITY_DELETED: 'activity.deleted',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditEntry {
  action: AuditAction;
  entityType?: string;
  entityId?: number;
  /**
   * Detalhes não sensíveis. Passa por uma lista de bloqueio antes de gravar —
   * ver `AuditService.sanitize`.
   */
  metadata?: Record<string, unknown>;
  /** Sobrescreve o ator do contexto (login falho não tem usuário autenticado). */
  actorId?: number | null;
  actorEmail?: string | null;
}
