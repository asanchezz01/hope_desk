/**
 * Política de repetição das queries (Fase 11).
 *
 * O caso que motiva o teste é o 429: com a repetição automática do TanStack
 * Query, cada tela que recebe "muitas tentativas" faria mais uma — contra o
 * mesmo limite que acabou de estourar, prolongando o bloqueio que a pessoa está
 * tentando esperar passar.
 */
import { ApiError, OFFLINE_STATUS } from '../api/client'

import { shouldRetryQuery } from './QueryProvider'

describe('shouldRetryQuery', () => {
  it('não repete o 429', () => {
    expect(shouldRetryQuery(0, new ApiError('limite', 429))).toBe(false)
  })

  it('não repete recusas determinísticas (401, 403, 404, 400)', () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(shouldRetryQuery(0, new ApiError('recusa', status))).toBe(false)
    }
  })

  it('repete uma vez erro do servidor e falta de conexão', () => {
    expect(shouldRetryQuery(0, new ApiError('servidor', 500))).toBe(true)
    expect(shouldRetryQuery(0, new ApiError('offline', OFFLINE_STATUS))).toBe(true)
  })

  it('repete no máximo uma vez', () => {
    expect(shouldRetryQuery(1, new ApiError('servidor', 500))).toBe(false)
  })

  it('repete erro que não é da API — pode ser falha momentânea de transporte', () => {
    expect(shouldRetryQuery(0, new TypeError('Network request failed'))).toBe(true)
  })
})
