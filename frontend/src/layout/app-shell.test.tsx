/**
 * O shell precisa oferecer navegação COMPLETA em qualquer largura.
 *
 * A regressão que este arquivo tranca é concreta: a coluna lateral só existe a
 * partir de 768px, e por um tempo não havia nada no lugar dela abaixo disso.
 * Quem entrava pelo celular ficava presa na primeira tela — sem painel, sem
 * relatórios, sem troca de senha, sem sair. Só apareceu quando alguém abriu o
 * sistema no telefone.
 *
 * Depois da padronização visual com a retaguarda do HopeSell há UMA navegação
 * só: a coluna carrega todos os destinos e, no celular, vira gaveta. O
 * sanduíche não convive mais com a coluna — ele É a coluna, quando ela não cabe.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'

import { ThemeProvider } from '../theme/ThemeContext'

import AppShell from './AppShell'

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

// O shell busca a logo da empresa; num ambiente de teste node a chamada de
// `fetch` real não interessa e nem existe — devolvemos a marca padrão.
jest.mock('../hooks/useCompanyLogo', () => ({
  useCompanyLogo: () => null,
}))

// O título ao lado da logo vem de um parâmetro de empresa, por react-query.
// Sem `QueryClientProvider` na árvore de teste, o hook real explodiria; e o
// que importa aqui é a navegação, não de onde o texto veio.
let mockHeaderTitle = 'Hope Desk'
jest.mock('../hooks/useHeaderTitle', () => ({
  useHeaderTitle: () => mockHeaderTitle,
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
    formMaxWidth: 760,
    gridColumns: mockHasSideNav ? 2 : 1,
  }),
}))

function renderShell() {
  return render(
    <ThemeProvider initialMode="light">
      <AppShell title="Indicadores">{null}</AppShell>
    </ThemeProvider>
  )
}

describe('AppShell', () => {
  beforeEach(() => {
    mockSignOut.mockClear()
    mockHeaderTitle = 'Hope Desk'
  })

  it('oferece o menu no celular, onde não há coluna lateral', () => {
    mockHasSideNav = false
    renderShell()

    // `accessibilityRole="menubar"` não sobrevive ao renderizador nativo de
    // teste; o que importa é que os destinos da coluna não estão na tela.
    expect(screen.queryByText('Relatórios')).toBeNull()
    expect(screen.getByRole('button', { name: 'Abrir menu de navegação' })).toBeTruthy()
  })

  it('no desktop a coluna carrega os destinos, e o sanduíche some', () => {
    // Uma navegação só: ter o sanduíche ao lado da coluna era oferecer dois
    // caminhos para a mesma lista, e por isso as duas divergiam.
    mockHasSideNav = true
    renderShell()

    expect(screen.getByText('Relatórios')).toBeTruthy()
    expect(screen.getByText('Trocar senha')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Abrir menu de navegação' })).toBeNull()
  })

  it('o título da tela vive no cabeçalho de conteúdo, não numa barra de topo', () => {
    mockHasSideNav = true
    renderShell()

    expect(screen.getByRole('header', { name: 'Indicadores' })).toHaveStyle({
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 26,
    })
  })

  it('mostra o título configurado ao lado da logo', () => {
    mockHasSideNav = true
    mockHeaderTitle = 'Acme Suporte'
    renderShell()

    expect(screen.getByText('Acme Suporte')).toBeTruthy()
  })

  it('título em branco deixa só a logo', () => {
    // Parâmetro de empresa vazio é uma ESCOLHA de quem já tem o nome desenhado
    // dentro da logo — não pode voltar para o "Hope Desk" fixo de antes.
    mockHasSideNav = true
    mockHeaderTitle = ''
    renderShell()

    expect(screen.queryByText('Hope Desk')).toBeNull()
    // A navegação continua inteira: sumiu o texto da marca, não a coluna.
    expect(screen.getByText('Relatórios')).toBeTruthy()
  })

  it('abre a gaveta com os destinos e permite sair por ela', () => {
    mockHasSideNav = false
    renderShell()

    fireEvent.press(screen.getByRole('button', { name: 'Abrir menu de navegação' }))

    expect(screen.getByText('Painel de Indicadores')).toBeTruthy()
    expect(screen.getByText('Trocar senha')).toBeTruthy()

    // "Sair" mora no rodapé da navegação, junto de quem está logado —
    // precisa continuar alcançável.
    fireEvent.press(screen.getByText('Sair'))
    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })
})
