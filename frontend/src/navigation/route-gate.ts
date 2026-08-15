// Regras de navegação pública/protegida (Fase 08).
//
// Função pura de propósito: as combinações de "autenticado × rota × troca de
// senha pendente" são o tipo de coisa que quebra em silêncio, e testá-las
// renderizando o router inteiro é lento e frágil.
//
// Isto é conveniência de navegação, NÃO autorização. A API recusa qualquer
// requisição por conta própria; esconder rota não protege nada.

/** Rotas acessíveis sem sessão. Correspondem a arquivos em `app/`. */
export const PUBLIC_SEGMENTS = ['login', 'forgot-password', 'reset-password'] as const

export const CHANGE_PASSWORD_SEGMENT = 'change-password'

export const ROUTES = {
  home: '/',
  login: '/login',
  changePassword: '/change-password',
} as const

export interface GateInput {
  isAuthenticated: boolean
  /**
   * A API bloqueia todas as rotas com 403 enquanto isto for verdadeiro, exceto
   * `/auth/me`, `/auth/change-password` e `/auth/logout*`. A navegação precisa
   * levar à troca de senha antes de qualquer outra tela.
   */
  mustChangePassword: boolean
  /** Primeiro segmento da rota atual (`undefined` na raiz). */
  segment: string | undefined
}

/** Para onde redirecionar, ou `null` para deixar a rota atual seguir. */
export function resolveRedirect({
  isAuthenticated,
  mustChangePassword,
  segment,
}: GateInput): string | null {
  const isPublic = PUBLIC_SEGMENTS.includes(segment as (typeof PUBLIC_SEGMENTS)[number])

  if (!isAuthenticated) {
    return isPublic ? null : ROUTES.login
  }

  // Autenticado com troca pendente só pode estar na tela de troca de senha.
  // Note que isto também tira o usuário das rotas públicas — logar e voltar
  // para /login não é um estado válido.
  if (mustChangePassword) {
    return segment === CHANGE_PASSWORD_SEGMENT ? null : ROUTES.changePassword
  }

  // Já autenticado e sem pendência: rota pública não faz mais sentido.
  if (isPublic) return ROUTES.home

  return null
}
