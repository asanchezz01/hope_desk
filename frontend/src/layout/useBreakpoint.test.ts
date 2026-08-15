import { BREAKPOINTS, breakpointFor } from './useBreakpoint'

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
