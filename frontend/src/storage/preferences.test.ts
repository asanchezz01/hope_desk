/**
 * Filtros salvos (Fase 11).
 *
 * O que está em disco foi escrito por uma versão anterior do aplicativo. Estes
 * testes travam a validação de leitura: sem ela, um `month` ausente ou um JSON
 * corrompido chegaria à query da API e a primeira abertura depois de uma
 * atualização responderia 400.
 */
import { parseTicketFilters } from './preferences'

const VALID = JSON.stringify({ year: 2026, month: 3, status: 'aberto' })

describe('parseTicketFilters', () => {
  it('lê um registro válido', () => {
    expect(parseTicketFilters(VALID)).toEqual({ year: 2026, month: 3, status: 'aberto' })
  })

  it('aceita o sentinela de "todo o período"', () => {
    const stored = JSON.stringify({ year: 0, month: 1, status: 'all' })
    expect(parseTicketFilters(stored)).toEqual({ year: 0, month: 1, status: 'all' })
  })

  it('devolve null para ausência e para JSON inválido', () => {
    expect(parseTicketFilters(null)).toBeNull()
    expect(parseTicketFilters('')).toBeNull()
    expect(parseTicketFilters('{ isso não é json')).toBeNull()
    expect(parseTicketFilters('"uma string"')).toBeNull()
    expect(parseTicketFilters('null')).toBeNull()
  })

  it('recusa registro de versão anterior sem os campos de hoje', () => {
    expect(parseTicketFilters(JSON.stringify({ year: 2026 }))).toBeNull()
    expect(parseTicketFilters(JSON.stringify({ month: 3, status: 'aberto' }))).toBeNull()
  })

  it('recusa mês fora de 1..12 e valores de tipo errado', () => {
    expect(
      parseTicketFilters(JSON.stringify({ year: 2026, month: 0, status: 'aberto' }))
    ).toBeNull()
    expect(
      parseTicketFilters(JSON.stringify({ year: 2026, month: 13, status: 'aberto' }))
    ).toBeNull()
    expect(
      parseTicketFilters(JSON.stringify({ year: 2026, month: 3.5, status: 'aberto' }))
    ).toBeNull()
    expect(
      parseTicketFilters(JSON.stringify({ year: '2026', month: 3, status: 'aberto' }))
    ).toBeNull()
    expect(parseTicketFilters(JSON.stringify({ year: 2026, month: 3, status: '' }))).toBeNull()
  })
})
