import { AuthenticatedUser } from '../auth/auth.types';
import { canDeleteByMonth } from '../common/domain/deletion-window';

/**
 * Políticas das atividades — funções **puras**, sem banco.
 *
 * Extraídas de `app.py`:
 *
 * | Ação | Regra do legado |
 * |---|---|
 * | criar | dentro de `ticket_detail`, sob `if role == "technician"` |
 * | editar | `@role_required("technician")` **e** `created_by_id == user_id` |
 * | excluir | `@role_required("technician")` + `can_delete_by_month(started_at)` |
 * | listar | qualquer autenticado, no escopo do chamado |
 */

/** Criar atividade exige papel de técnico (superuser passa por herança). */
export function canCreateActivity(user: AuthenticatedUser): boolean {
  return user.role === 'technician' || user.isSuperuser;
}

/**
 * Editar atividade: **somente o autor**.
 *
 * ⚠️ A regra mais contraintuitiva do domínio. `edit_activity` faz
 * `if activity.created_by_id != current_user_id` **sem exceção para
 * superuser** — diferente de praticamente todo o resto do sistema. Um
 * superuser **não** edita atividade lançada por outro técnico.
 *
 * Confirmado linha a linha em `app.py` na Fase 05.
 */
export function canEditActivity(
  user: AuthenticatedUser,
  activity: { createdById: number },
): boolean {
  if (!canCreateActivity(user)) return false;
  return activity.createdById === user.id;
}

/**
 * Excluir atividade: técnico no mês corrente, superuser em qualquer mês.
 *
 * A janela usa `activity.started_at`, que é **hora de parede** — portanto sem
 * a distorção de 3h que afeta a exclusão de chamados (ver §4.1).
 *
 * Note que o legado **não** exige ser o autor para excluir, ao contrário da
 * edição. Qualquer técnico exclui atividade do mês corrente.
 */
export function canDeleteActivity(
  user: AuthenticatedUser,
  activity: { startedAt: Date },
  now?: Date,
): boolean {
  if (!canCreateActivity(user)) return false;

  return canDeleteByMonth({
    recordDate: activity.startedAt,
    kind: 'wall-clock',
    isSuperuser: user.isSuperuser,
    now,
  });
}
