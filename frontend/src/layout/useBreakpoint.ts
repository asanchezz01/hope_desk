// Breakpoints do shell adaptativo (Fase 08).
//
// `useWindowDimensions` reage a rotação, split-screen no tablet e redimensionar
// a janela no Web — coisas que uma medição única no mount perderia.
import { useWindowDimensions } from 'react-native'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

/** Limites em pixels lógicos. Alinhados aos tamanhos usuais de tablet. */
export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
} as const

export function breakpointFor(width: number): Breakpoint {
  if (width >= BREAKPOINTS.desktop) return 'desktop'
  if (width >= BREAKPOINTS.tablet) return 'tablet'
  return 'mobile'
}

export interface BreakpointInfo {
  width: number
  breakpoint: Breakpoint
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  /** Navegação lateral fixa cabe a partir do tablet. */
  hasSideNav: boolean
  /** Largura máxima de leitura confortável para o conteúdo central. */
  contentMaxWidth: number
}

export function useBreakpoint(): BreakpointInfo {
  const { width } = useWindowDimensions()
  const breakpoint = breakpointFor(width)

  return {
    width,
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    hasSideNav: breakpoint !== 'mobile',
    contentMaxWidth: breakpoint === 'desktop' ? 1120 : 840,
  }
}
