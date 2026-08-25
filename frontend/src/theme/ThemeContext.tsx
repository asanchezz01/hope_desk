// Tema claro/escuro da retaguarda do Hope Desk.
//
// As cores NÃO nascem aqui: elas vêm de `tokens.ts`, que é a porta de entrada
// do preset compartilhado da retaguarda NewHope (ver o cabeçalho daquele
// arquivo). Este módulo só faz o trabalho que o Tailwind faz do outro lado —
// escolher, POR TEMA, qual degrau de cada escala vai em cada papel:
//
//   claro   papel `slate-50`, cartão branco, ação `brand-700` sobre ele;
//   escuro  noite `slate-950`, superfície `slate-900`, ação `brand-400`.
//
// O par de degraus por papel existe por contraste, não por gosto: `brand-700`
// sobre a noite dá ~2,4:1 e `brand-400` sobre o papel dá ~1,9:1 — cada um só
// funciona no seu modo. `theme.test.ts` tranca esses números.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useColorScheme } from 'react-native'

import { readThemeMode, saveThemeMode } from '../storage/preferences'

import { accent, amber, blue, brand, green, red, slate } from './tokens'

export interface ThemeColors {
  background: string
  cardBg: string
  /** Fundo da coluna de navegação e das barras de cabeçalho. */
  surfaceNav: string
  /** Fundo de linha alternada / cabeçalho de tabela / estado recessivo. */
  surfaceMuted: string
  textPrimary: string
  textSecondary: string
  border: string
  muted: string
  /** Verde-esperança da ação primária, no degrau que o modo aguenta. */
  primary: string
  /** Fundo tênue da mesma hue: item de menu ativo, chip selecionado, ícone. */
  primarySoft: string
  /** Texto/ícone sobre `primarySoft`. */
  onPrimarySoft: string
  secondary: string
  accent: string
  danger: string
  /** Fundo tênue de erro — usado pelo alerta e pelo hover de "Sair". */
  dangerSoft: string
  success: string
  warning: string
  info: string
  /** Cor de texto sobre `primary`/`danger`/`success` preenchidos. */
  onAccentText: string
  text: string
  /**
   * Hue única das barras de MAGNITUDE (por módulo, técnico, cliente, tendência).
   * Separada de `primary` de propósito: `primary` é escolhida por contraste de
   * TEXTO (WCAG AA), e a marca de gráfico é escolhida por contraste contra a
   * superfície do gráfico.
   */
  chartMagnitude: string
  /** Trilho de fundo das barras, um passo acima da superfície. */
  chartTrack: string
  /**
   * Segunda série dos gráficos sobrepostos (a linha de horas sobre as colunas
   * de chamados). Separada de `accent` porque um âmbar claro de PREENCHIMENTO
   * reprova como LINHA de 2px sobre o cartão claro.
   */
  chartSecondary: string
}

export const lightTheme: ThemeColors = {
  // `slate-50` e não `slate-100` (o fundo do HopeSell): sobre `slate-100` a ação
  // `brand-700` fica em 4,49:1, um fio abaixo dos 4,5:1 da WCAG AA que o teste
  // exige do texto do botão de contorno. Um degrau mais claro no papel preserva
  // o verde EXATO da marca, que é o que a padronização está atrás.
  background: slate[50],
  cardBg: '#ffffff',
  surfaceNav: '#ffffff',
  surfaceMuted: slate[100],
  textPrimary: slate[900],
  textSecondary: slate[700],
  border: slate[200],
  muted: slate[500],
  primary: brand[700],
  primarySoft: brand[50],
  onPrimarySoft: brand[800],
  secondary: slate[700],
  // `accent-400` (#f2bc62) é ouro de PREENCHIMENTO; como texto sobre papel dá
  // 1,8:1. O degrau 600 é o mesmo âmbar legível.
  accent: accent[600],
  danger: red[600],
  dangerSoft: red[50],
  success: green[700],
  warning: amber[600],
  info: blue[600],
  onAccentText: '#ffffff',
  text: slate[900],
  chartMagnitude: brand[700],
  chartTrack: slate[200],
  chartSecondary: accent[600],
}

export const darkTheme: ThemeColors = {
  background: slate[950],
  cardBg: slate[900],
  surfaceNav: slate[900],
  surfaceMuted: slate[800],
  textPrimary: slate[100],
  textSecondary: slate[300],
  border: slate[800],
  muted: slate[400],
  primary: brand[400],
  // `brand-900/40` do HopeSell resolvido para um valor opaco: em RN a
  // transparência sobre um pai já colorido não é confiável entre plataformas.
  primarySoft: '#0e2b26',
  onPrimarySoft: brand[200],
  secondary: slate[300],
  accent: accent[400],
  danger: red[400],
  dangerSoft: '#2a1519',
  success: green[400],
  warning: amber[400],
  info: blue[400],
  // No escuro os preenchimentos são claros, então o texto sobre eles é escuro.
  onAccentText: slate[950],
  text: slate[100],
  chartMagnitude: green[400],
  chartTrack: slate[800],
  chartSecondary: accent[400],
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

/**
 * `true` no tema escuro.
 *
 * Existe para os gráficos: as cores de status precisam de degraus mais claros
 * sobre o cartão escuro (ver `chart-palette.ts`), e um componente de gráfico
 * não deveria puxar `mode` e `setMode` só para descobrir isso.
 */
export function useIsDark(): boolean {
  return useContext(ThemeContext).isDark
}
