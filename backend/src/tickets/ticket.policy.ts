import { AuthenticatedUser } from '../auth/auth.types';
import { canDeleteByMonth } from '../common/domain/deletion-window';

/**
 * Políticas de autorização dos chamados — funções **puras**, sem banco.
 *
 * Extraídas de `app.py`:
 *
 * | Rota | Decorators | Consequência |
 * |---|---|---|
 * | `new_ticket` | `@login_required` apenas | **cliente também cria** |
 * | `edit_ticket` | `@role_required("technician")` | cliente não edita |
 * | `ticket_detail` | `@login_required` | cliente vê só os próprios |
 * | `ticket_detail` POST | `if role == "technician"` | só técnico muda status |
 * | `delete_ticket` | `@role_required("technician")` + janela de mês | — |
 *
 * Lembrando que `role_required` do legado deixa **superuser passar sempre**
 * (`if user_role not in roles and not is_super`).
 */

/** Quem pode abrir chamado em nome de um cliente, em vez de para si. */
export function canCreateForOtherClient(user: AuthenticatedUser): boolean {
  // Legado: can_create_for_client = role == "technician" or is_super
  return user.role === 'technician' || user.isSuperuser;
}

/** Quem pode editar chamado: técnico ou superuser. */
export function canEditTicket(user: AuthenticatedUser): boolean {
  return user.role === 'technician' || user.isSuperuser;
}

/** Quem pode mudar status: mesma regra da edição. */
export function canChangeStatus(user: AuthenticatedUser): boolean {
  return canEditTicket(user);
}

/**
 * Quem pode ver um chamado.
 *
 * Cliente vê somente os próprios (`ticket.client_id != session["user_id"]` →
 * redireciona). Técnico e superuser veem todos. Este é o ponto de IDOR
 * principal do domínio.
 */
export function canViewTicket(
  user: AuthenticatedUser,
  ticket: { clientId: number },
): boolean {
  if (user.role === 'client') {
    return ticket.clientId === user.id;
  }
  return true;
}

/**
 * Quem pode excluir um chamado.
 *
 * Exige papel de técnico **e** janela de mês. O superuser satisfaz as duas
 * partes: passa no `role_required` e ignora a janela.
 */
export function canDeleteTicket(
  user: AuthenticatedUser,
  ticket: { createdAt: Date },
  now?: Date,
): boolean {
  if (!canEditTicket(user)) return false;

  return canDeleteByMonth({
    // `ticket.created_at` é instante UTC — ver deletion-window.ts.
    recordDate: ticket.createdAt,
    kind: 'utc-instant',
    isSuperuser: user.isSuperuser,
    now,
  });
}

/**
 * Resolve o cliente do chamado na criação.
 *
 * Cliente sempre abre para si: qualquer `clientId` vindo do corpo é
 * **ignorado**, não é erro — é a proteção contra IDOR na criação.
 * Técnico e superuser precisam informar o cliente explicitamente.
 */
export function resolveTicketClientId(
  user: AuthenticatedUser,
  requestedClientId: number | undefined,
): { clientId: number | null; requiresExplicitClient: boolean } {
  if (canCreateForOtherClient(user)) {
    return {
      clientId: requestedClientId ?? null,
      requiresExplicitClient: true,
    };
  }

  // Cliente: ignora o que veio no corpo e usa a própria identidade.
  return { clientId: user.id, requiresExplicitClient: false };
}
