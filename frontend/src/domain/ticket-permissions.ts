// Espelho, no cliente, das políticas de chamado do backend (`ticket.policy.ts`
// e `deletion-window.ts`).
//
// Por que espelhar em vez de usar dicas do servidor: `ActivityResponse` traz
// `canEdit`/`canDelete`, mas `TicketResponse` **não**. Sem isto, a UI ou mostra
// botões que resultam em 403, ou esconde ações que o usuário poderia fazer.
//
// Isto é APENAS conveniência de interface. A autorização é do servidor, que
// recusa por conta própria — esconder botão não protege nada.

import type { ApiUser } from '../api/client'

/** `role_required` do legado deixa superuser passar sempre. */
function isTechnicianOrSuperuser(user: ApiUser): boolean {
  return user.role === 'technician' || user.isSuperuser
}

/** Cliente também abre chamado — `new_ticket` só tem `@login_required`. */
export function canCreateTicket(): boolean {
  return true
}

/** Abrir em nome de outro cliente: técnico ou superuser. */
export function canCreateForOtherClient(user: ApiUser): boolean {
  return isTechnicianOrSuperuser(user)
}

export function canEditTicket(user: ApiUser): boolean {
  return isTechnicianOrSuperuser(user)
}

/** Mudar status segue a mesma regra da edição. */
export function canChangeTicketStatus(user: ApiUser): boolean {
  return canEditTicket(user)
}

/** Só técnico e superuser registram atividades. */
export function canCreateActivity(user: ApiUser): boolean {
  return isTechnicianOrSuperuser(user)
}

const LEGACY_TIMEZONE = 'America/Sao_Paulo'

interface YearMonth {
  year: number
  month: number
}

/**
 * "Agora" em hora de parede de São Paulo, como o `datetime.now()` do legado —
 * e não a hora do aparelho, que pode estar em qualquer fuso.
 */
function nowInLegacyTimezone(now: Date): YearMonth {
  try {
    const fields = new Intl.DateTimeFormat('en-CA', {
      timeZone: LEGACY_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(now)

    const get = (type: string) => Number(fields.find((part) => part.type === type)?.value)
    const year = get('year')
    const month = get('month')
    if (Number.isFinite(year) && Number.isFinite(month)) return { year, month }
  } catch {
    // Runtime sem dados de fuso (Hermes sem ICU completo, por exemplo).
  }

  // Degradação: usa o relógio local. Pode divergir da regra do servidor em
  // aparelhos fora do fuso de São Paulo — e por isso a API continua sendo a
  // palavra final sobre a exclusão.
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

/**
 * `can_delete_by_month` do legado, para chamados.
 *
 * A assimetria abaixo é DELIBERADA e está documentada em
 * `LEGACY_CONTRACTS.md` §4.1: o legado compara os componentes de
 * `ticket.created_at` — um instante **UTC** — com os de `datetime.now()`, que é
 * hora **local**. O resultado desloca a fronteira do mês em 3 horas: um chamado
 * criado em 31/07 às 21:00 de São Paulo (= 01/08 00:00 UTC) conta como sendo de
 * agosto. Corrigir aqui faria a UI discordar da API justamente na virada do mês.
 */
export function canDeleteTicket(
  user: ApiUser,
  ticket: { createdAt: string },
  now: Date = new Date()
): boolean {
  if (!canEditTicket(user)) return false
  if (user.isSuperuser) return true

  const created = new Date(ticket.createdAt)
  if (Number.isNaN(created.getTime())) return false

  // Componentes UTC do registro, como `storageToWallClock` no servidor.
  const record = { year: created.getUTCFullYear(), month: created.getUTCMonth() + 1 }
  const current = nowInLegacyTimezone(now)

  return record.year === current.year && record.month === current.month
}

export const TICKET_DELETE_WINDOW_MESSAGE =
  'Somente chamados do mês corrente podem ser excluídos. ' +
  'Para meses anteriores, apenas superuser pode excluir.'
