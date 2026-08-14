// Tema claro/escuro do Hope Desk (Fase 08).
//
// Duas coisas diferentes convivem aqui, e misturá-las é o erro fácil:
//
//   `palette`  — as cores canônicas do legado (#0c4e9a, #234783, #ffcc00,
//                #d92120, #1f9d55). São IDENTIDADE. Não mudam com o tema, e
//                são as mesmas que a API devolve em `statusMeta` para os
//                gráficos. Use-as quando a cor precisa bater com o backend.
//
//   `primary`, `danger`, ... — as variantes de USO, ajustadas por tema para
//                manter contraste legível. No claro elas são iguais às
//                canônicas; no escuro são clareadas, porque #0c4e9a sobre
//                #111827 fica em ~1,9:1, muito abaixo dos 4,5:1 da WCAG AA.
//
// O teste theme.test.ts trava esses contrastes.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useColorScheme } from 'react-native'

import { readThemeMode, saveThemeMode } from '../storage/preferences'

export interface Palette {
  primary: string // #0c4e9a
  secondary: string // #234783
  accent: string // #ffcc00
  danger: string // #d92120
  success: string // #1f9d55
}

export interface ThemeColors {
  background: string
  cardBg: string
  textPrimary: string
  textSecondary: string
  border: string
  muted: string
  /** Cores canônicas do legado — iguais em qualquer tema. */
  palette: Palette
  /** Variantes de uso, ajustadas ao tema para manter contraste. */
  primary: string
  secondary: string
  accent: string
  danger: string
  success: string
  /** Cor de texto sobre `primary`/`danger`/`success` preenchidos. */
  onAccentText: string
  text: string
}

/** Paleta do legado. Identidade da marca — não varia com o tema. */
export const LEGACY_PALETTE: Palette = {
  primary: '#0c4e9a',
  secondary: '#234783',
  accent: '#ffcc00',
  danger: '#d92120',
  success: '#1f9d55',
}

export const lightTheme: ThemeColors = {
  background: '#fafafa',
  cardBg: '#ffffff',
  textPrimary: '#1f2937',
  textSecondary: '#4b5563',
  border: '#e5e7eb',
  muted: '#6b7280',
  palette: LEGACY_PALETTE,
  primary: LEGACY_PALETTE.primary,
  secondary: LEGACY_PALETTE.secondary,
  // #ffcc00 sobre branco tem contraste baixíssimo para texto; o âmbar escuro
  // abaixo preserva a leitura de "destaque" sem virar um texto ilegível.
  accent: '#8a6d00',
  danger: LEGACY_PALETTE.danger,
  success: '#157f42',
  onAccentText: '#ffffff',
  text: '#1f2937',
}

export const darkTheme: ThemeColors = {
  background: '#111827',
  cardBg: '#1e293b',
  textPrimary: '#f3f4f6',
  textSecondary: '#cbd5e1',
  border: '#334155',
  muted: '#94a3b8',
  palette: LEGACY_PALETTE,
  primary: '#6aa9e9',
  secondary: '#9db4e2',
  accent: '#ffcc00',
  danger: '#f87171',
  success: '#4ade80',
  // No escuro os preenchimentos são claros, então o texto sobre eles é escuro.
  onAccentText: '#111827',
  text: '#f3f4f6',
}

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  colors: ThemeColors
  isDark: boolean
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightTheme,
  isDark: false,
  mode: 'system',
  setMode: () => undefined,
})

interface ThemeProviderProps {
  children: React.ReactNode
  /** Usado nos testes e no Storybook; em produção a preferência vem do disco. */
  initialMode?: ThemeMode
}

export function ThemeProvider({ children, initialMode }: ThemeProviderProps) {
  const systemScheme = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>(initialMode ?? 'system')

  // Uma preferência explícita via prop vence o disco (testes). Sem ela,
  // restaura o que o usuário escolheu da última vez.
  useEffect(() => {
    if (initialMode) return
    let active = true
    readThemeMode().then((stored) => {
      if (active && stored) setModeState(stored)
    })
    return () => {
      active = false
    }
  }, [initialMode])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    void saveThemeMode(next)
  }, [])

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark'
  const colors = isDark ? darkTheme : lightTheme

  const value = useMemo(() => ({ colors, isDark, mode, setMode }), [colors, isDark, mode, setMode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/** Cores do tema corrente. É o que a maioria dos componentes precisa. */
export function useTheme(): ThemeColors {
  return useContext(ThemeContext).colors
}

/** Controle do modo — para o seletor de tema. */
export function useThemeMode(): Omit<ThemeContextValue, 'colors'> {
  const { mode, setMode, isDark } = useContext(ThemeContext)
  return { mode, setMode, isDark }
}
