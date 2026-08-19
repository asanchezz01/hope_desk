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

/**
 * Colunas de uma grade de cartões, a partir da largura da JANELA.
 *
 * Deliberadamente contínuo, e não derivado de `Breakpoint`: 'desktop' cobre de
 * 1024 a 4K, e um único número de colunas para essa faixa inteira deixaria
 * metade da tela vazia num monitor grande. Os limites já descontam a coluna de
 * navegação (216) e a folga da página — em 1180 sobram ~900 para duas colunas
 * de ~440, que é onde o cartão de chamado ainda cabe sem quebrar o título.
 */
export function gridColumnsFor(width: number): number {
  if (width >= 1600) return 3
  if (width >= 1180) return 2
  return 1
}

/**
 * Teto para as telas que dispõem o conteúdo em GRADE — a listagem de chamados e
 * o painel. Só elas: travar em 1120 num monitor de 1920 desperdiça um terço da
 * largura QUANDO há colunas para preencher.
 *
 * Uma lista de LINHAS não entra aqui. Esticada a 1680 ela vira nome à esquerda,
 * botão à direita e 1400px de nada no meio — pior de ler, não melhor.
 */
export function wideMaxWidthFor(width: number): number {
  if (width >= 1600) return 1680
  if (width >= BREAKPOINTS.desktop) return 1360
  return 840
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
  /** Teto das telas em grade (listagem de chamados, painel). */
  wideMaxWidth: number
  /**
   * Teto para conteúdo em COLUNA ÚNICA — formulários, sobretudo.
   *
   * Um campo de texto de 1600px de largura não é melhor que um de 720: o olho
   * perde o começo da linha ao voltar, e o rótulo fica longe do valor. Alargar
   * a página serve à grade, não ao formulário.
   */
  formMaxWidth: number
  /** Colunas para grades de cartões nesta largura. */
  gridColumns: number
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
    wideMaxWidth: wideMaxWidthFor(width),
    formMaxWidth: 760,
    gridColumns: gridColumnsFor(width),
  }
}
