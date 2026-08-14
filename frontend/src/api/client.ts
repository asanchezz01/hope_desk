// Cliente HTTP do Hope Desk (Fase 08).
//
// O ponto crítico desta camada é o refresh rotativo. A API revoga o refresh
// token a cada uso e registra `replaced_by_jti`; reapresentar um token já
// rotacionado é tratado como REUSO e derruba TODA a família de tokens do
// usuário (Fase 02). Duas requisições que recebem 401 ao mesmo tempo e chamam
// `/auth/refresh` cada uma com o mesmo token deslogam o usuário de todos os
// dispositivos. Por isso:
//
//   1. o refresh é single-flight — o primeiro dispara, os demais aguardam;
//   2. antes de disparar, a requisição confere se a sessão em disco já mudou;
//      se mudou, outro refresh já resolveu e ela apenas repete com o token novo.
//
// Sem (2), uma requisição que ficou parada durante um refresh anterior
// dispararia um segundo refresh com o token velho — exatamente o caso que a
// detecção de reuso pune.
import {
  clearSession,
  readSession,
  saveSession,
  type StoredSession,
} from '../storage/session-storage'

const DEFAULT_API_URL = 'http://localhost:3000/api/v1'

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '')

export type UserRole = 'client' | 'technician'

export interface ApiUser {
  id: number
  name: string
  email: string
  role: UserRole
  isSuperuser: boolean
  mustChangePassword: boolean
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
}

export interface LoginResponse extends TokenPair {
  user: ApiUser
}

/**
 * Valor monetário ou de horas vindo da API. `value` é exato e serve para
 * cálculo; `formatted` já vem em pt-BR e serve para exibir. Nunca reparse o
 * `formatted` — a vírgula decimal se perde no caminho.
 */
export interface DecimalValue {
  value: string
  formatted: string
}

/** Status HTTP sintético para "não foi possível chegar ao servidor". */
export const OFFLINE_STATUS = 0

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** Sem rede, DNS falhou, servidor fora do ar. */
  get isOffline(): boolean {
    return this.status === OFFLINE_STATUS
  }

  /** Sessão inválida ou expirada. */
  get isUnauthorized(): boolean {
    return this.status === 401
  }

  /** Autenticado, mas sem permissão. Inclui o bloqueio de troca de senha. */
  get isForbidden(): boolean {
    return this.status === 403
  }

  /**
   * A API devolve 404 (e não 403) para recurso de outro cliente, de propósito:
   * um 403 confirmaria que o recurso existe. Trate como "não encontrado".
   */
  get isNotFound(): boolean {
    return this.status === 404
  }

  get isValidation(): boolean {
    return this.status === 400 || this.status === 422
  }
}

/** Avisado quando a sessão morre de vez, para a UI voltar ao login. */
type SessionExpiredListener = () => void

const sessionExpiredListeners = new Set<SessionExpiredListener>()

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener)
  return () => {
    sessionExpiredListeners.delete(listener)
  }
}

function notifySessionExpired(): void {
  for (const listener of [...sessionExpiredListeners]) {
    try {
      listener()
    } catch {
      // Um ouvinte com defeito não pode impedir os outros de serem avisados.
    }
  }
}

let refreshInFlight: Promise<StoredSession> | null = null

/**
 * Executa o refresh no máximo uma vez por vez. Quem chegar durante um refresh
 * em andamento recebe a mesma promise — é a "fila" que o roadmap exige.
 */
async function refreshSession(refreshToken: string): Promise<StoredSession> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    try {
      const pair = await rawRequest<TokenPair>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      })
      const next: StoredSession = {
        accessToken: pair.accessToken,
        refreshToken: pair.refreshToken,
      }
      await saveSession(next)
      return next
    } catch (error) {
      // Refresh recusado: a sessão acabou. Um erro de rede também cai aqui,
      // mas insistir com um token possivelmente rotacionado é pior do que
      // pedir login de novo.
      await clearSession()
      notifySessionExpired()
      throw error
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

/** Requisição sem autenticação nem retry. Base de tudo o mais. */
async function rawRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(
      'Não foi possível conectar ao servidor. Verifique sua conexão.',
      OFFLINE_STATUS
    )
  }

  if (response.status === 204) return undefined as T

  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false
  const body = isJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    throw new ApiError(messageFrom(body, response.status), response.status, body)
  }

  return body as T
}

function messageFrom(body: unknown, status: number): string {
  const message = (body as { message?: unknown } | null)?.message
  if (Array.isArray(message)) return message.filter((item) => typeof item === 'string').join(' ')
  if (typeof message === 'string' && message.length > 0) return message
  if (status >= 500) return 'O servidor não conseguiu responder. Tente novamente em instantes.'
  return 'Não foi possível concluir a solicitação.'
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Serializado como JSON. Use `rawBody` para enviar outra coisa. */
  body?: unknown
  rawBody?: BodyInit
  /** Rota pública: não anexa token nem tenta refresh. */
  anonymous?: boolean
}

/** Requisição autenticada, com refresh enfileirado e um único retry. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, rawBody, anonymous = false, ...init } = options
  const payload: BodyInit | undefined =
    rawBody ?? (body === undefined ? undefined : JSON.stringify(body))

  if (anonymous) {
    return rawRequest<T>(path, { ...init, body: payload })
  }

  const session = await readSession()

  try {
    return await rawRequest<T>(path, {
      ...init,
      body: payload,
      headers: withAuth(init.headers, session),
    })
  } catch (error) {
    if (!(error instanceof ApiError) || !error.isUnauthorized || !session) throw error

    // Alguém pode ter renovado a sessão enquanto esta requisição estava no ar.
    // Nesse caso o token novo já está em disco e refazer o refresh usaria um
    // token rotacionado — o gatilho da detecção de reuso.
    const current = await readSession()
    const alreadyRenewed = current !== null && current.accessToken !== session.accessToken
    const renewed = alreadyRenewed ? current : await refreshSession(session.refreshToken)

    return rawRequest<T>(path, {
      ...init,
      body: payload,
      headers: withAuth(init.headers, renewed),
    })
  }
}

function withAuth(headers: HeadersInit | undefined, session: StoredSession | null): Headers {
  const result = new Headers(headers)
  if (session?.accessToken) result.set('Authorization', `Bearer ${session.accessToken}`)
  return result
}

/**
 * Superfície tipada da API. A Fase 08 cobre apenas autenticação e saúde —
 * chamados, atividades, analytics e administração entram nas Fases 09 e 10.
 */
export interface MessageResponse {
  message: string
}

export const api = {
  health: () => request<{ status: string }>('/health', { anonymous: true }),

  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      anonymous: true,
    }),

  currentUser: () => request<ApiUser>('/auth/me'),

  // `logout` é rota pública na API: revoga o refresh token apresentado e é
  // idempotente. Não exige — nem depende de — um access token válido.
  logout: (refreshToken: string) =>
    request<MessageResponse>('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      anonymous: true,
    }),

  logoutAll: () => request<MessageResponse>('/auth/logout-all', { method: 'POST' }),

  // Os nomes dos campos seguem os DTOs do backend (`password`/`confirmation`).
  // A API roda com `forbidNonWhitelisted`, então qualquer campo a mais — ou um
  // `newPassword` "mais legível" — devolve 400 em vez de ser ignorado.
  //
  // Atenção: trocar a senha encerra as demais sessões do usuário. A UI precisa
  // levar de volta ao login depois desta chamada.
  changePassword: (input: { currentPassword: string; password: string; confirmation: string }) =>
    request<MessageResponse>('/auth/change-password', { method: 'POST', body: input }),

  forgotPassword: (email: string) =>
    request<MessageResponse>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
      anonymous: true,
    }),

  resetPassword: (input: { token: string; password: string; confirmation: string }) =>
    request<MessageResponse>('/auth/reset-password', {
      method: 'POST',
      body: input,
      anonymous: true,
    }),

  request,
}

/** Só para os testes: zera o refresh pendente entre casos. */
export function __resetClientState(): void {
  refreshInFlight = null
  sessionExpiredListeners.clear()
}
