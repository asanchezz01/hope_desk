import { BREAKPOINTS, breakpointFor, gridColumnsFor, wideMaxWidthFor } from './useBreakpoint'

describe('breakpointFor', () => {
  it('classifica as larguras típicas de cada família de aparelho', () => {
    expect(breakpointFor(360)).toBe('mobile') // celular comum
    expect(breakpointFor(768)).toBe('tablet') // iPad retrato
    expect(breakpointFor(1024)).toBe('desktop') // iPad paisagem / notebook
    expect(breakpointFor(1440)).toBe('desktop')
  })

  it('trata os limites como inclusivos na faixa de cima', () => {
    expect(breakpointFor(BREAKPOINTS.tablet - 1)).toBe('mobile')
    expect(breakpointFor(BREAKPOINTS.tablet)).toBe('tablet')
    expect(breakpointFor(BREAKPOINTS.desktop - 1)).toBe('tablet')
    expect(breakpointFor(BREAKPOINTS.desktop)).toBe('desktop')
  })

  it('não quebra em larguras degeneradas', () => {
    expect(breakpointFor(0)).toBe('mobile')
  })
})

describe('gridColumnsFor', () => {
  it('mantém coluna única enquanto duas não couberem', () => {
    expect(gridColumnsFor(360)).toBe(1) // celular
    expect(gridColumnsFor(1024)).toBe(1) // notebook estreito: nav + 2 colunas não cabem
    expect(gridColumnsFor(1179)).toBe(1)
  })

  it('abre colunas conforme a tela cresce', () => {
    expect(gridColumnsFor(1180)).toBe(2)
    expect(gridColumnsFor(1440)).toBe(2)
    expect(gridColumnsFor(1600)).toBe(3)
    expect(gridColumnsFor(2560)).toBe(3)
  })

  it('nunca devolve zero — uma FlatList com numColumns 0 não renderiza', () => {
    expect(gridColumnsFor(0)).toBe(1)
  })
})

describe('wideMaxWidthFor', () => {
  it('cresce por faixa, sem passar de um teto', () => {
    expect(wideMaxWidthFor(360)).toBe(840)
    expect(wideMaxWidthFor(900)).toBe(840)
    expect(wideMaxWidthFor(1024)).toBe(1360)
    expect(wideMaxWidthFor(1920)).toBe(1680)
  })
})
