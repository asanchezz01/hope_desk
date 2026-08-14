import type { ApiUser } from '../api/client'

import {
  canChangeTicketStatus,
  canCreateActivity,
  canCreateForOtherClient,
  canDeleteTicket,
  canEditTicket,
} from './ticket-permissions'

function user(overrides: Partial<ApiUser> = {}): ApiUser {
  return {
    id: 1,
    name: 'Fulano',
    email: 'fulano@exemplo.com',
    role: 'client',
    isSuperuser: false,
    mustChangePassword: false,
    ...overrides,
  }
}

const CLIENT = user()
const TECHNICIAN = user({ id: 2, role: 'technician' })
const SUPERUSER = user({ id: 3, role: 'technician', isSuperuser: true })
/** Superuser com papel de cliente: `role_required` do legado deixa passar. */
const CLIENT_SUPERUSER = user({ id: 4, role: 'client', isSuperuser: true })

describe('edição e status', () => {
  it('cliente não edita nem muda status', () => {
    expect(canEditTicket(CLIENT)).toBe(false)
    expect(canChangeTicketStatus(CLIENT)).toBe(false)
  })

  it('técnico e superuser editam', () => {
    expect(canEditTicket(TECHNICIAN)).toBe(true)
    expect(canEditTicket(SUPERUSER)).toBe(true)
  })

  it('superuser passa mesmo com papel de cliente', () => {
    // `if user_role not in roles and not is_super` — o legado libera superuser
    // independentemente do papel.
    expect(canEditTicket(CLIENT_SUPERUSER)).toBe(true)
  })
})

describe('abertura em nome de outro cliente', () => {
  it('cliente abre somente para si', () => {
    expect(canCreateForOtherClient(CLIENT)).toBe(false)
  })

  it('técnico e superuser escolhem o cliente', () => {
    expect(canCreateForOtherClient(TECHNICIAN)).toBe(true)
    expect(canCreateForOtherClient(SUPERUSER)).toBe(true)
  })
})

describe('registro de atividade', () => {
  it('é restrito a técnico e superuser', () => {
    expect(canCreateActivity(CLIENT)).toBe(false)
    expect(canCreateActivity(TECHNICIAN)).toBe(true)
  })
})

describe('janela de exclusão', () => {
  // Referência: 15/08/2026 12:00 em São Paulo (UTC-3) = 15:00 UTC.
  const NOW = new Date('2026-08-15T15:00:00.000Z')

  const thisMonth = { createdAt: '2026-08-10T12:00:00.000Z' }
  const lastMonth = { createdAt: '2026-07-10T12:00:00.000Z' }

  it('cliente nunca exclui', () => {
    expect(canDeleteTicket(CLIENT, thisMonth, NOW)).toBe(false)
  })

  it('técnico exclui do mês corrente', () => {
    expect(canDeleteTicket(TECHNICIAN, thisMonth, NOW)).toBe(true)
  })

  it('técnico não exclui de mês anterior', () => {
    expect(canDeleteTicket(TECHNICIAN, lastMonth, NOW)).toBe(false)
  })

  it('superuser exclui de qualquer mês', () => {
    expect(canDeleteTicket(SUPERUSER, lastMonth, NOW)).toBe(true)
    expect(canDeleteTicket(SUPERUSER, { createdAt: '2019-01-01T00:00:00.000Z' }, NOW)).toBe(true)
  })

  it('reproduz a distorção de 3 horas do legado na virada do mês', () => {
    // 31/07 às 21:00 em São Paulo é 01/08 00:00 UTC. O legado compara os
    // componentes UTC do registro com o mês LOCAL de "agora" e, por isso, trata
    // este chamado como sendo de AGOSTO. A distorção é preservada de propósito
    // (LEGACY_CONTRACTS.md §4.1): corrigi-la aqui faria a UI discordar da API
    // exatamente nas 3 primeiras horas do dia 1º.
    const criadoNaViradaUtc = { createdAt: '2026-08-01T00:00:00.000Z' }
    expect(canDeleteTicket(TECHNICIAN, criadoNaViradaUtc, NOW)).toBe(true)
  })

  it('não quebra com data inválida', () => {
    expect(canDeleteTicket(TECHNICIAN, { createdAt: 'nada disso' }, NOW)).toBe(false)
  })
})
