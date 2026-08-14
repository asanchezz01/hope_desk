/**
 * Testes do cliente HTTP, com foco no refresh rotativo.
 *
 * A API revoga o refresh token a cada uso e trata a reapresentação de um token
 * já rotacionado como REUSO, revogando todas as sessões do usuário. Um cliente
 * que dispara dois `/auth/refresh` com o mesmo token desloga a pessoa de todos
 * os dispositivos — e o sintoma aparece longe da causa. Estes testes travam o
 * comportamento que evita isso.
 */
import { clearSession, readSession, saveSession } from '../storage/session-storage'

import { api, ApiError, onSessionExpired, request, __resetClientState } from './client'

jest.mock('../storage/session-storage', () => {
  let stored: { accessToken: string; refreshToken: string } | null = null
  return {
    readSession: jest.fn(async () => stored),
    saveSession: jest.fn(async (session: { accessToken: string; refreshToken: string }) => {
      stored = session
    }),
    clearSession: jest.fn(async () => {
      stored = null
    }),
    __setSession: (session: { accessToken: string; refreshToken: string } | null) => {
      stored = session
    },
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
const storageMock = require('../storage/session-storage') as {
  __setSession(session: { accessToken: string; refreshToken: string } | null): void
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>()

beforeEach(() => {
  __resetClientState()
  jest.clearAllMocks()
  storageMock.__setSession(null)
  global.fetch = fetchMock as unknown as typeof fetch
})

function authHeaderOf(call: [string, RequestInit]): string | null {
  return new Headers(call[1].headers).get('Authorization')
}

describe('refresh rotativo', () => {
  it('dispara um único /auth/refresh para várias requisições que recebem 401 juntas', async () => {
    storageMock.__setSession({ accessToken: 'velho', refreshToken: 'refresh-1' })

    fetchMock.mockImplementation(async (url, init) => {
      if (url.endsWith('/auth/refresh')) {
        return jsonResponse(200, {
          accessToken: 'novo',
          refreshToken: 'refresh-2',
          expiresIn: 900,
          tokenType: 'Bearer',
        })
      }
      const token = new Headers(init.headers).get('Authorization')
      if (token === 'Bearer novo') return jsonResponse(200, { ok: url })
      return jsonResponse(401, { message: 'Token expirado.' })
    })

    const [a, b, c] = await Promise.all([
      request<{ ok: string }>('/tickets'),
      request<{ ok: string }>('/users'),
      request<{ ok: string }>('/parameters/public'),
    ])

    const refreshCalls = fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))
    expect(refreshCalls).toHaveLength(1)

    // E todas as três requisições foram concluídas, não abortadas.
    expect([a.ok, b.ok, c.ok].map((url) => url.split('/api/v1')[1]).sort()).toEqual([
      '/parameters/public',
      '/tickets',
      '/users',
    ])

    // O refresh usou o token original uma única vez.
    expect(JSON.parse(String(refreshCalls[0][1].body))).toEqual({ refreshToken: 'refresh-1' })
    expect(saveSession).toHaveBeenCalledWith({ accessToken: 'novo', refreshToken: 'refresh-2' })
  })

  it('não refaz o refresh quando a sessão já foi renovada por outra requisição', async () => {
    storageMock.__setSession({ accessToken: 'velho', refreshToken: 'refresh-1' })

    fetchMock.mockImplementation(async (url, init) => {
      const token = new Headers(init.headers).get('Authorization')
      if (token === 'Bearer velho') {
        // Simula a corrida: enquanto esta requisição estava no ar, outra já
        // renovou a sessão e gravou o par novo no disco.
        storageMock.__setSession({ accessToken: 'novo', refreshToken: 'refresh-2' })
        return jsonResponse(401, { message: 'Token expirado.' })
      }
      return jsonResponse(200, { ok: true })
    })

    await expect(request<{ ok: boolean }>('/tickets')).resolves.toEqual({ ok: true })

    // O ponto do teste: nenhum /auth/refresh com o token velho, que dispararia
    // a detecção de reuso e derrubaria todas as sessões.
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(0)
    expect(authHeaderOf(fetchMock.mock.calls[1])).toBe('Bearer novo')
  })

  it('não tenta refresh mais de uma vez para a mesma requisição', async () => {
    storageMock.__setSession({ accessToken: 'velho', refreshToken: 'refresh-1' })

    fetchMock.mockImplementation(async (url) => {
      if (url.endsWith('/auth/refresh')) {
        return jsonResponse(200, {
          accessToken: 'novo',
          refreshToken: 'refresh-2',
          expiresIn: 900,
          tokenType: 'Bearer',
        })
      }
      // O servidor continua recusando mesmo com o token novo.
      return jsonResponse(401, { message: 'Token expirado.' })
    })

    await expect(request('/tickets')).rejects.toMatchObject({ status: 401 })
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1)
  })

  it('limpa a sessão e avisa os ouvintes quando o refresh é recusado', async () => {
    storageMock.__setSession({ accessToken: 'velho', refreshToken: 'reusado' })
    const expired = jest.fn()
    onSessionExpired(expired)

    fetchMock.mockImplementation(async (url) => {
      if (url.endsWith('/auth/refresh')) return jsonResponse(401, { message: 'Token reutilizado.' })
      return jsonResponse(401, { message: 'Token expirado.' })
    })

    await expect(request('/tickets')).rejects.toBeInstanceOf(ApiError)
    expect(clearSession).toHaveBeenCalled()
    expect(expired).toHaveBeenCalledTimes(1)
  })

  it('não anexa token nem tenta refresh em rota anônima', async () => {
    storageMock.__setSession({ accessToken: 'velho', refreshToken: 'refresh-1' })
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Credenciais inválidas.' }))

    await expect(api.login('a@b.com', 'errada')).rejects.toMatchObject({ status: 401 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(authHeaderOf(fetchMock.mock.calls[0])).toBeNull()
  })
})

describe('erros', () => {
  it('classifica falha de rede como offline, não como erro do servidor', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))

    const error = await request('/health', { anonymous: true }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).isOffline).toBe(true)
    expect((error as ApiError).status).toBe(0)
  })

  it('junta a lista de mensagens do ValidationPipe numa frase só', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { message: ['Informe a senha.', 'Informe um e-mail válido.'] })
    )

    const error = (await api.login('invalido', '').catch((e: unknown) => e)) as ApiError

    expect(error.isValidation).toBe(true)
    expect(error.message).toBe('Informe a senha. Informe um e-mail válido.')
  })

  it('distingue 403 de 404 — a API usa 404 para recurso de outro cliente', async () => {
    storageMock.__setSession({ accessToken: 'ok', refreshToken: 'r' })
    fetchMock.mockResolvedValue(jsonResponse(404, { message: 'Chamado não encontrado.' }))

    const error = (await request('/tickets/1').catch((e: unknown) => e)) as ApiError

    expect(error.isNotFound).toBe(true)
    expect(error.isForbidden).toBe(false)
  })

  it('trata 204 sem corpo sem tentar parsear JSON', async () => {
    storageMock.__setSession({ accessToken: 'ok', refreshToken: 'r' })
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(request('/tickets/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })
})

describe('contrato com o backend', () => {
  it('envia password/confirmation na troca de senha, como o DTO exige', async () => {
    storageMock.__setSession({ accessToken: 'ok', refreshToken: 'r' })
    fetchMock.mockResolvedValue(jsonResponse(200, { message: 'ok' }))

    await api.changePassword({
      currentPassword: 'antiga',
      password: 'nova-senha',
      confirmation: 'nova-senha',
    })

    // A API roda com forbidNonWhitelisted: um campo `newPassword` daria 400.
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      currentPassword: 'antiga',
      password: 'nova-senha',
      confirmation: 'nova-senha',
    })
  })

  it('lê a sessão do armazenamento a cada requisição', async () => {
    storageMock.__setSession({ accessToken: 'ok', refreshToken: 'r' })
    fetchMock.mockResolvedValue(jsonResponse(200, {}))

    await request('/auth/me')

    expect(readSession).toHaveBeenCalled()
    expect(authHeaderOf(fetchMock.mock.calls[0])).toBe('Bearer ok')
  })
})
