/**
 * O layout raiz precisa montar o navegador em TODO render.
 *
 * O defeito que este teste trava: o gate devolvia o splash (ou um
 * `<Redirect>`) *no lugar* do `<Slot />`. O expo-router então tentava navegar
 * antes de existir navegador e derrubava a aplicação inteira com
 *
 *     Attempted to navigate before mounting the Root Layout component
 *
 * resultando em **tela branca** no Web — em toda abertura, não num caso de
 * borda. Nada pegava isso: `resolveRedirect` é função pura e continuava
 * correta, e o `expo export` monta cada rota isoladamente, sem passar pelo
 * gate.
 *
 * Por isso o teste olha para a ESTRUTURA renderizada, não para o destino do
 * redirecionamento (que já tem cobertura própria em `route-gate.test.ts`).
 *
 * Mora em `src/`, e não ao lado do layout: **todo** arquivo dentro de `app/` é
 * tratado como rota pelo expo-router. Um `.test.tsx` ali vira uma rota sem
 * componente padrão e o servidor de desenvolvimento passa a responder 500 —
 * exatamente o que aconteceu na primeira versão deste arquivo.
 */
import { render, screen } from '@testing-library/react-native'
import React from 'react'
import { Text } from 'react-native'

import RootLayout from '../../app/_layout'

jest.mock('expo-router', () => ({
  Slot: () => {
    const { Text: RNText } = jest.requireActual('react-native')
    return <RNText testID="slot">slot montado</RNText>
  },
  Redirect: ({ href }: { href: string }) => {
    const { Text: RNText } = jest.requireActual('react-native')
    return <RNText testID="redirect">{href}</RNText>
  },
  useSegments: () => [],
}))

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }))

const authState = {
  isLoading: true,
  user: null as { id: number } | null,
  mustChangePassword: false,
}

jest.mock('../context/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => authState,
}))

jest.mock('../providers/QueryProvider', () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('layout raiz', () => {
  it('monta o Slot enquanto a sessão está sendo lida', () => {
    authState.isLoading = true
    authState.user = null

    render(<RootLayout />)

    expect(screen.getByTestId('slot')).toBeTruthy()
    // O splash cobre por cima, em vez de substituir.
    expect(screen.getByLabelText('Carregando')).toBeTruthy()
    expect(screen.queryByTestId('redirect')).toBeNull()
  })

  it('monta o Slot também quando há redirecionamento pendente', () => {
    // Anônimo numa rota protegida: o gate manda para /login — e é justamente
    // aqui que o `<Redirect>` precisa de um navegador já montado.
    authState.isLoading = false
    authState.user = null

    render(<RootLayout />)

    expect(screen.getByTestId('slot')).toBeTruthy()
    expect(screen.getByTestId('redirect')).toBeTruthy()
  })

  it('monta o Slot sem redirecionar quando a sessão é válida', () => {
    authState.isLoading = false
    authState.user = { id: 1 }

    render(<RootLayout />)

    expect(screen.getByTestId('slot')).toBeTruthy()
    expect(screen.queryByTestId('redirect')).toBeNull()
    expect(screen.queryByLabelText('Carregando')).toBeNull()
  })
})

// `Text` importado só para manter o JSX válido no arquivo de teste.
void Text
