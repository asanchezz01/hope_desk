import { resolveRedirect, ROUTES } from './route-gate'

describe('gate de navegação', () => {
  describe('sem sessão', () => {
    it('manda para o login em qualquer rota protegida', () => {
      expect(
        resolveRedirect({ isAuthenticated: false, mustChangePassword: false, segment: undefined })
      ).toBe(ROUTES.login)
      expect(
        resolveRedirect({ isAuthenticated: false, mustChangePassword: false, segment: 'tickets' })
      ).toBe(ROUTES.login)
    })

    it('deixa passar as rotas públicas', () => {
      for (const segment of ['login', 'forgot-password', 'reset-password']) {
        expect(
          resolveRedirect({ isAuthenticated: false, mustChangePassword: false, segment })
        ).toBeNull()
      }
    })

    it('não manda para a troca de senha — sem sessão não há senha a trocar', () => {
      expect(
        resolveRedirect({ isAuthenticated: false, mustChangePassword: true, segment: 'tickets' })
      ).toBe(ROUTES.login)
    })
  })

  describe('com sessão', () => {
    it('deixa a rota protegida seguir', () => {
      expect(
        resolveRedirect({ isAuthenticated: true, mustChangePassword: false, segment: 'tickets' })
      ).toBeNull()
    })

    it('tira o usuário logado das rotas públicas', () => {
      expect(
        resolveRedirect({ isAuthenticated: true, mustChangePassword: false, segment: 'login' })
      ).toBe(ROUTES.home)
    })

    it('permite trocar a senha voluntariamente', () => {
      expect(
        resolveRedirect({
          isAuthenticated: true,
          mustChangePassword: false,
          segment: 'change-password',
        })
      ).toBeNull()
    })
  })

  describe('troca de senha obrigatória', () => {
    // A API responde 403 em todas as rotas exceto /auth/me, /auth/change-password
    // e /auth/logout* enquanto mustChangePassword for verdadeiro. Se a navegação
    // não levar à troca, o usuário vê uma sequência de erros sem explicação.
    it('captura qualquer rota protegida', () => {
      for (const segment of [undefined, 'tickets', 'analytics', 'admin']) {
        expect(resolveRedirect({ isAuthenticated: true, mustChangePassword: true, segment })).toBe(
          ROUTES.changePassword
        )
      }
    })

    it('captura também as rotas públicas — logar e voltar ao login não é estado válido', () => {
      expect(
        resolveRedirect({ isAuthenticated: true, mustChangePassword: true, segment: 'login' })
      ).toBe(ROUTES.changePassword)
    })

    it('não redireciona quem já está na troca de senha, senão o redirect entra em laço', () => {
      expect(
        resolveRedirect({
          isAuthenticated: true,
          mustChangePassword: true,
          segment: 'change-password',
        })
      ).toBeNull()
    })
  })
})
