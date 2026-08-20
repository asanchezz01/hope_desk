/**
 * "Enums" do legado.
 *
 * No banco, `user.role` e `ticket.status` são VarChar — não tipos enum do
 * PostgreSQL. Isso é intencional: um tipo enum nativo quebraria a escrita do
 * SQLAlchemy durante a operação paralela (ver docs/LEGACY_CONTRACTS.md).
 * A garantia de valores válidos fica em três camadas:
 *   1. estes tipos (compilação);
 *   2. class-validator nos DTOs (borda HTTP);
 *   3. CHECK constraints no banco (migration).
 */

export const USER_ROLES = ['client', 'technician'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const TICKET_STATUSES = [
  'aberto',
  'em_andamento',
  'resolvido',
  'fechado',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Rótulos de apresentação — `normalize_status` do legado. */
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  aberto: 'Em aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Concluído',
  fechado: 'Fechado',
};

/** Chaves de `system_parameter` usadas pelo legado, com os mesmos defaults. */
export const SYSTEM_PARAMETER_DEFAULTS = {
  company_logo: '',
  company_logo_dark: '',
  company_name: 'Hope Desk',
  company_address: 'Endereço não informado',
  monthly_hours_allowance: '16',
  activity_hourly_rate: '0',
  hours_bank_closing_date: '2000-01-01',
} as const;

export type SystemParameterKey = keyof typeof SYSTEM_PARAMETER_DEFAULTS;

export const SYSTEM_PARAMETER_KEYS = Object.keys(
  SYSTEM_PARAMETER_DEFAULTS,
) as SystemParameterKey[];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return (
    typeof value === 'string' && (TICKET_STATUSES as readonly string[]).includes(value)
  );
}

/** `normalize_status` do legado: rótulo conhecido ou Title Case do valor cru. */
export function statusLabel(status: string): string {
  if (isTicketStatus(status)) {
    return TICKET_STATUS_LABELS[status];
  }
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
