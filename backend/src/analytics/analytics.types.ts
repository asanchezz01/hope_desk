/**
 * Contratos do analytics, espelhando `analytics_dashboard` do legado.
 *
 * O legado envia linhas cruas para o template e faz os filtros cruzados em
 * JavaScript. A API mantém as duas coisas: **agregações** prontas para os
 * gráficos e as **linhas** necessárias para o frontend refazer filtros cruzados
 * sem novo request.
 */

/** Granularidade do eixo do gráfico. */
/**
 * Granularidade do eixo do tempo.
 *
 *   'day'    dia do mês (1..31) — só serve DENTRO de um mês, que é o caso da
 *            visão mensal; a chave repetiria entre meses diferentes;
 *   'date'   data completa (aaaa-mm-dd) — para a janela móvel, que atravessa
 *            a virada do mês;
 *   'month'  aaaa-mm.
 */
export type BucketMode = 'day' | 'date' | 'month';

export interface AnalyticsBucket {
  /** Dia do mês (`day`) ou `AAAA-MM` (`month`). */
  key: string;
  label: string;
}

export interface AnalyticsTicketRow {
  id: number;
  title: string;
  status: string;
  statusLabel: string;
  module: string;
  client: string;
  /** Técnico designado, ou "-". */
  technician: string;
  /** Técnicos que registraram atividade, mais o designado. */
  technicians: string[];
  bucket: string;
  createdAt: string;
  createdLabel: string;
  /** Soma das horas de todas as atividades do chamado. */
  hours: number;
  /**
   * Horas até a primeira atividade. `null` quando não há atividade.
   *
   * ATENÇÃO: o legado calcula `first_activity.started_at - ticket.created_at`,
   * subtraindo hora de **parede** de instante **UTC** — um desvio de 3h.
   * Preservado; ver docs/LEGACY_CONTRACTS.md §13.
   */
  responseHours: number | null;
  /** Idade em dias; `null` para chamados concluídos. */
  ageDays: number | null;
}

export interface AnalyticsActivityRow {
  ticketId: number;
  bucket: string;
  technician: string;
  hours: number;
  status: string;
  module: string;
  client: string;
}

export interface AnalyticsTrendPoint {
  label: string;
  year: number;
  month: number;
  tickets: number;
  hours: number;
}

export interface CountByKey {
  key: string;
  label: string;
  count: number;
  hours: number;
}

export interface AnalyticsKpis {
  totalTickets: number;
  concludedTickets: number;
  openTickets: number;
  totalHours: number;
  /** Média de horas por chamado no período. */
  averageHoursPerTicket: number;
  /** Média de horas até a primeira atividade, entre os que têm atividade. */
  averageFirstResponseHours: number | null;
  /** Chamados com pelo menos uma atividade. */
  ticketsWithActivity: number;
}

export interface AnalyticsBacklog {
  /** Chamados `aberto` ou `em_andamento`, em **todo** o histórico do escopo. */
  total: number;
  /** Idade em dias do mais antigo em aberto. */
  oldestDays: number;
  oldestTicketId: number | null;
}

/**
 * Cores de status, no padrão visual da retaguarda NewHope — o frontend não
 * reinventa a paleta, e o espelho dela mora em
 * `frontend/src/domain/ticket-status.ts`. Mudou aqui, mude lá.
 */
export const ANALYTICS_STATUS_META: Record<string, { label: string; color: string }> = {
  aberto: { label: 'Em aberto', color: '#b03a3a' }, // red-600
  em_andamento: { label: 'Em andamento', color: '#a2600b' }, // amber-600
  resolvido: { label: 'Concluído', color: '#0d7f57' }, // green-700
  fechado: { label: 'Fechado', color: '#1f5fe0' }, // blue-600
};

export const MONTHS_PT: { value: number; label: string }[] = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

export const MONTH_SHORT_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];
