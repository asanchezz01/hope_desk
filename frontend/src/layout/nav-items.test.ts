import type { ApiUser } from '../api/client'

import { menuItemsFor, navItemsFor } from './nav-items'

function userWith(overrides: Partial<ApiUser>): ApiUser {
  return {
    id: 1,
    name: 'Fulano',
    email: 'fulano@hope.com',
    role: 'technician',
    isSuperuser: false,
    mustChangePassword: false,
    ...overrides,
  } as ApiUser
}

/** Rótulos visíveis, na ordem — é o que a pessoa enxerga no menu. */
function visibleLabels(items: { label: string; visible?: boolean }[]): string[] {
  return items.filter((item) => item.visible !== false).map((item) => item.label)
}

describe('menuItemsFor', () => {
  it('leva o cliente ao painel, aos chamados, aos relatórios e à troca de senha', () => {
    const items = menuItemsFor(userWith({ role: 'client' }))

    expect(visibleLabels(items)).toEqual([
      'Painel de Indicadores',
      'Chamados',
      'Relatórios',
      'Alterar Senha',
    ])
  })

  it('dá ao técnico a gestão de usuários, e só ela', () => {
    // `/admin/users` exige @Roles('technician'); as outras três exigem
    // superusuário. Mostrar as demais ao técnico ofereceria um 403.
    const items = menuItemsFor(userWith({ role: 'technician' }))

    expect(visibleLabels(items)).toContain('Gerenciar Usuários')
    expect(visibleLabels(items)).not.toContain('Parâmetros da Empresa')
    expect(visibleLabels(items)).not.toContain('Módulos do Sistema')
    expect(visibleLabels(items)).not.toContain('Cadastro de Pagamentos')
  })

  it('abre as três telas administrativas para o superusuário', () => {
    const items = menuItemsFor(userWith({ role: 'technician', isSuperuser: true }))

    expect(visibleLabels(items)).toEqual([
      'Painel de Indicadores',
      'Chamados',
      'Relatórios',
      'Parâmetros da Empresa',
      'Módulos do Sistema',
      'Cadastro de Pagamentos',
      'Gerenciar Usuários',
      'Alterar Senha',
    ])
  })

  it('mostra as telas administrativas a um cliente marcado como superusuário', () => {
    // O legado decide por `is_superuser`, não pelo papel: um cliente
    // superusuário administra o sistema.
    const items = menuItemsFor(userWith({ role: 'client', isSuperuser: true }))

    expect(visibleLabels(items)).toContain('Cadastro de Pagamentos')
    expect(visibleLabels(items)).toContain('Gerenciar Usuários')
  })

  it('sem sessão, não oferece caminho nenhum protegido', () => {
    expect(visibleLabels(menuItemsFor(null))).toEqual([
      'Painel de Indicadores',
      'Chamados',
      'Relatórios',
      'Alterar Senha',
    ])
  })
})

describe('navItemsFor', () => {
  it('começa pelo Painel — é para onde o login leva', () => {
    // A lateral e o destino do login precisam concordar: se o primeiro item
    // não fosse o painel, a tela inicial não teria marcador ativo nenhum.
    expect(navItemsFor(userWith({})).map((item) => item.href)[0]).toBe('/analytics')
  })

  it('esconde a Administração de quem não é técnico nem superusuário', () => {
    expect(visibleLabels(navItemsFor(userWith({ role: 'client' })))).not.toContain('Administração')
    expect(visibleLabels(navItemsFor(userWith({ role: 'client', isSuperuser: true })))).toContain(
      'Administração'
    )
  })
})
