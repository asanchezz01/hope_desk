/**
 * O shell precisa oferecer navegação em QUALQUER largura.
 *
 * A regressão que este arquivo tranca é concreta: a coluna lateral só existe a
 * partir de 768px, e por um tempo não havia nada no lugar dela abaixo disso.
 * Quem entrava pelo celular ficava presa na primeira tela — sem painel, sem
 * relatórios, sem troca de senha, sem sair. Só apareceu quando alguém abriu o
 * sistema no telefone.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'

import { ThemeProvider } from '../theme/ThemeContext'

import AppShell from './AppShell'
import { navItemsFor } from './nav-items'

jest.mock('expo-router', () => ({
  usePathname: () => '/analytics',
  useRouter: () => ({ push: jest.fn() }),
}))

const mockSignOut = jest.fn()
const mockUser = {
  id: 2,
  name: 'Anderson Sanchez',
  email: 'anderson@hope.com',
  role: 'technician',
  isSuperuser: false,
  mustChangePassword: false,
}

jest.mock('../context/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser, signOut: mockSignOut }),
}))

// O shell agora busca a logo da empresa; num ambiente de teste node a chamada
// de `fetch` real não interessa e nem existe — devolvemos a marca padrão.
jest.mock('../hooks/useCompanyLogo', () => ({
  useCompanyLogo: () => null,
}))

// O preset do React Native já substitui `useWindowDimensions` por um valor
// fixo, então mockar a largura por lá não funciona. O alvo certo é o nosso
// hook — `breakpointFor` tem teste próprio em `useBreakpoint.test.ts`.
let mockHasSideNav = true
jest.mock('./useBreakpoint', () => ({
  useBreakpoint: () => ({
    width: mockHasSideNav ? 1280 : 390,
    breakpoint: mockHasSideNav ? 'desktop' : 'mobile',
    isMobile: !mockHasSideNav,
    isTablet: false,
    isDesktop: mockHasSideNav,
    hasSideNav: mockHasSideNav,
    contentMaxWidth: mockHasSideNav ? 1120 : 840,
    wideMaxWidth: mockHasSideNav ? 1360 : 840,
    formMaxWidth: 760,
    gridColumns: mockHasSideNav ? 2 : 1,
  }),
}))

function renderShell() {
  return render(
    <ThemeProvider initialMode="light">
      <AppShell title="Indicadores" navItems={navItemsFor(mockUser as never)}>
        {null}
      </AppShell>
    </ThemeProvider>
  )
}

describe('AppShell', () => {
  beforeEach(() => {
    mockSignOut.mockClear()
  })

  it('oferece o menu no celular, onde não há coluna lateral', () => {
    mockHasSideNav = false
    renderShell()

    // `accessibilityRole="menubar"` não sobrevive ao renderizador nativo de
    // teste; o que importa é que os destinos da lateral não estão na tela.
    expect(screen.queryByText('Relatórios')).toBeNull()
    expect(screen.getByRole('button', { name: 'Abrir menu de navegação' })).toBeTruthy()
  })

  it('mantém o menu no desktop, ao lado da coluna lateral', () => {
    // A lateral tem os atalhos do dia a dia; o menu tem a lista inteira. No
    // legado a navbar e o sanduíche conviviam pelo mesmo motivo.
    mockHasSideNav = true
    renderShell()

    expect(screen.getByText('Relatórios')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Abrir menu de navegação' })).toBeTruthy()
  })

  it('padroniza o título e o separa visualmente da logo', () => {
    renderShell()

    expect(screen.getByRole('header', { name: 'Indicadores' })).toHaveStyle({
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 24,
    })
    expect(screen.getByTestId('page-title-separator')).toHaveStyle({ width: 1, height: 20 })
  })

  it('abre o menu com os destinos e permite sair por ele', () => {
    mockHasSideNav = false
    renderShell()

    fireEvent.press(screen.getByRole('button', { name: 'Abrir menu de navegação' }))

    expect(screen.getByText('Painel de Indicadores')).toBeTruthy()
    expect(screen.getByText('Alterar Senha')).toBeTruthy()

    // "Sair" saiu do cabeçalho e passou a morar no menu, como no legado —
    // precisa continuar alcançável.
    fireEvent.press(screen.getByText('Sair'))
    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })
})
