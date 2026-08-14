import { instantToWallClockParts, storageToWallClock } from '../time/legacy-clock';

/**
 * `can_delete_by_month` do legado:
 *
 * ```python
 * def can_delete_by_month(record_date, is_superuser):
 *     now = datetime.now()
 *     is_current_month = record_date.year == now.year and record_date.month == now.month
 *     return is_current_month or is_superuser
 * ```
 *
 * Registro do mês corrente: qualquer técnico exclui.
 * Mês anterior ou futuro: somente superuser.
 *
 * ## A inconsistência preservada
 *
 * `datetime.now()` é hora **local** (America/Sao_Paulo), mas os dois campos
 * comparados têm significados diferentes (ver docs/LEGACY_CONTRACTS.md §4):
 *
 * - `ticket.created_at` é um instante **UTC** → comparar seus componentes com
 *   os de "agora local" desloca a fronteira do mês em 3 horas. Um chamado
 *   criado em 31/07 às 21:00 local (= 01/08 00:00 UTC) é tratado como sendo de
 *   **agosto**.
 * - `activity.started_at` é hora de **parede** → a comparação é coerente, sem
 *   deslocamento.
 *
 * A distorção só aparece nas 3 primeiras horas do dia 1º de cada mês. Ela é
 * **preservada deliberadamente** para manter paridade comportamental com o
 * Flask durante a operação paralela. Ver `docs/LEGACY_CONTRACTS.md` §4.1.
 */

/** Qual significado o timestamp armazenado carrega. */
export type StoredTimeKind =
  /** Instante UTC — `ticket.created_at`, `payment_record.created_at`. */
  | 'utc-instant'
  /** Hora de parede de São Paulo — `activity.started_at` / `ended_at`. */
  | 'wall-clock';

export interface DeletionWindowContext {
  /** Valor lido do banco. */
  recordDate: Date;
  kind: StoredTimeKind;
  isSuperuser: boolean;
  /** Injetável para teste; default é o instante atual. */
  now?: Date;
}

export function canDeleteByMonth(context: DeletionWindowContext): boolean {
  if (context.isSuperuser) {
    // Superuser exclui em qualquer mês, sem depender da comparação.
    return true;
  }

  // Componentes do registro: `getUTC*` devolve o que o Python leria como naive,
  // tanto para instante UTC quanto para hora de parede armazenada.
  const record = storageToWallClock(context.recordDate);

  // "Agora" segue `datetime.now()` do legado: hora local de São Paulo.
  const now = instantToWallClockParts(context.now ?? new Date());

  return record.year === now.year && record.month === now.month;
}

/** Mensagem do legado para chamados. */
export const TICKET_DELETE_WINDOW_MESSAGE =
  'Somente chamados do mês corrente podem ser excluídos. ' +
  'Para meses anteriores, apenas superuser pode excluir.';

/** Mensagem do legado para atividades. */
export const ACTIVITY_DELETE_WINDOW_MESSAGE =
  'Somente atividades do mês corrente podem ser excluídas. ' +
  'Para meses anteriores, apenas superuser pode excluir.';
