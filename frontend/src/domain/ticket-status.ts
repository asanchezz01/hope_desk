// Espelho do domínio de status do backend (`legacy-enums.ts` e
// `ANALYTICS_STATUS_META`). As cores são as mesmas que a API devolve em
// `statusMeta` para os gráficos — mantê-las aqui evita que a lista de chamados
// e o gráfico de status discordem sobre a cor de "aberto". Mudou aqui, mude lá.
//
// Os quatro degraus vêm das escalas SEMÂNTICAS do preset compartilhado da
// retaguarda NewHope (`theme/tokens.ts`): vermelho para o que urge, âmbar para
// o que está em curso, verde para o que fechou bem, azul para o que só
// encerrou. O significado é o mesmo do legado; o degrau é o do padrão.
//
// `statusLabel` reproduz `normalize_status` do legado, inclusive a tolerância a
// status desconhecido: Title Case do valor cru, sem erro.

export const TICKET_STATUSES = ['aberto', 'em_andamento', 'resolvido', 'fechado'] as const

export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_STATUS_META: Record<TicketStatus, { label: string; color: string }> = {
  aberto: { label: 'Em aberto', color: '#b03a3a' }, // red-600
  em_andamento: { label: 'Em andamento', color: '#a2600b' }, // amber-600
  resolvido: { label: 'Concluído', color: '#0d7f57' }, // green-700
  fechado: { label: 'Fechado', color: '#1f5fe0' }, // blue-600
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
  return isTicketStatus(status) ? TICKET_STATUS_META[status].color : '#576d84'
}

// Inverso de `TICKET_STATUS_META`: rótulo -> chave.
const STATUS_KEY_BY_LABEL: Record<string, TicketStatus> = {
  [TICKET_STATUS_META.aberto.label]: 'aberto',
  [TICKET_STATUS_META.em_andamento.label]: 'em_andamento',
  [TICKET_STATUS_META.resolvido.label]: 'resolvido',
  [TICKET_STATUS_META.fechado.label]: 'fechado',
}

/**
 * Normaliza o `status` que chega da API para a **chave** canônica.
 *
 * A maioria dos endpoints devolve a chave (`aberto`, `em_andamento`...), mas o
 * de relatórios devolve o **rótulo** já localizado (`Em andamento`). Como
 * `statusColor`, `statusChartColor` e `StatusBadge` são indexados pela chave,
 * normalizar aqui evita o tom de fallback (cinza) ao pintar um card por status.
 * Devolve `null` quando o valor não é reconhecido, para o chamante escolher o
 * tratamento neutro.
 */
export function statusKeyFromRaw(raw: string): TicketStatus | null {
  if (isTicketStatus(raw)) return raw
  return STATUS_KEY_BY_LABEL[raw] ?? null
}
