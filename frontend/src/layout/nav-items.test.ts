import type { ApiUser } from '../api/client'

import { menuItemsFor, menuSectionsFor } from './nav-items'

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
      'Trocar senha',
    ])
  })

  it('dá ao técnico a gestão de usuários, e só ela', () => {
    // `/admin/users` exige @Roles('technician'); as outras três exigem
    // superusuário. Mostrar as demais ao técnico ofereceria um 403.
    const items = menuItemsFor(userWith({ role: 'technician' }))

    expect(visibleLabels(items)).toContain('Usuários')
    expect(visibleLabels(items)).not.toContain('Parâmetros da empresa')
    expect(visibleLabels(items)).not.toContain('Módulos do sistema')
    expect(visibleLabels(items)).not.toContain('Pagamentos')
  })

  it('abre as três telas administrativas para o superusuário', () => {
    const items = menuItemsFor(userWith({ role: 'technician', isSuperuser: true }))

    expect(visibleLabels(items)).toEqual([
      'Painel de Indicadores',
      'Chamados',
      'Relatórios',
      'Administração',
      'Parâmetros da empresa',
      'Módulos do sistema',
      'Pagamentos',
      'Usuários',
      'Trocar senha',
    ])
  })

  it('mostra as telas administrativas a um cliente marcado como superusuário', () => {
    // O legado decide por `is_superuser`, não pelo papel: um cliente
    // superusuário administra o sistema.
    const items = menuItemsFor(userWith({ role: 'client', isSuperuser: true }))

    expect(visibleLabels(items)).toContain('Pagamentos')
    expect(visibleLabels(items)).toContain('Usuários')
  })

  it('sem sessão, não oferece caminho nenhum protegido', () => {
    expect(visibleLabels(menuItemsFor(null))).toEqual([
      'Painel de Indicadores',
      'Chamados',
      'Relatórios',
      'Trocar senha',
    ])
  })
})

describe('menuSectionsFor', () => {
  it('começa pelo Painel — é para onde o login leva', () => {
    // A coluna e o destino do login precisam concordar: se o primeiro item não
    // fosse o painel, a tela inicial não teria marcador ativo nenhum.
    expect(menuItemsFor(userWith({})).map((item) => item.href)[0]).toBe('/analytics')
  })

  it('agrupa por assunto, com os atalhos do dia a dia sem cabeçalho', () => {
    const sections = menuSectionsFor(userWith({ role: 'technician', isSuperuser: true }))

    expect(sections.map((section) => section.title)).toEqual([null, 'Administração', 'Conta'])
  })

  it('some com a seção inteira quando o perfil não tem nenhum item dela', () => {
    // Senão sobraria o cabeçalho "Administração" sozinho, sem nada embaixo.
    const sections = menuSectionsFor(userWith({ role: 'client' }))

    expect(sections.map((section) => section.title)).toEqual([null, 'Conta'])
  })
})
