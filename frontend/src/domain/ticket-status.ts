// Espelho do domínio de status do backend (`legacy-enums.ts` e
// `ANALYTICS_STATUS_META`). As cores são as canônicas do legado e são as mesmas
// que a API devolve em `statusMeta` para os gráficos — mantê-las aqui evita que
// a lista de chamados e o gráfico de status discordem sobre a cor de "aberto".
//
// `statusLabel` reproduz `normalize_status` do legado, inclusive a tolerância a
// status desconhecido: Title Case do valor cru, sem erro.

export const TICKET_STATUSES = ['aberto', 'em_andamento', 'resolvido', 'fechado'] as const

export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_STATUS_META: Record<TicketStatus, { label: string; color: string }> = {
  aberto: { label: 'Em aberto', color: '#d92120' },
  em_andamento: { label: 'Em andamento', color: '#ffcc00' },
  resolvido: { label: 'Concluído', color: '#1f9d55' },
  fechado: { label: 'Fechado', color: '#234783' },
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === 'string' && (TICKET_STATUSES as readonly string[]).includes(value)
}

export function statusLabel(status: string): string {
  if (isTicketStatus(status)) return TICKET_STATUS_META[status].label
  return status.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

/** Cor canônica do status, ou um cinza neutro para valores desconhecidos. */
export function statusColor(status: string): string {
  return isTicketStatus(status) ? TICKET_STATUS_META[status].color : '#6b7280'
}
