/**
 * Contraste do tema (WCAG 2.1 AA).
 *
 * Contraste é verificável, então é teste — não inspeção visual. O alvo é 4,5:1
 * para texto normal e 3:1 para elementos gráficos e texto grande.
 *
 * Estes números são o motivo de cada papel ter um degrau POR TEMA em vez de uma
 * cor só: `brand-700` sobre a noite dá ~2,4:1 e `brand-400` sobre o papel dá
 * ~1,9:1. Nenhum dos dois serve nos dois modos.
 */
import { darkTheme, lightTheme, type ThemeColors } from './ThemeContext'
import { brand, slate } from './tokens'

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

const AA_TEXT = 4.5
const AA_LARGE = 3

describe('contraste', () => {
  it('a fórmula bate com os pares de referência da WCAG', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 1)
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })

  const themes: [string, ThemeColors][] = [
    ['claro', lightTheme],
    ['escuro', darkTheme],
  ]

  it('o verde da marca mantém contraste AA no degrau de cada tema', () => {
    expect(contrast(brand[700], lightTheme.background)).toBeGreaterThanOrEqual(AA_TEXT)
    expect(contrast(brand[700], lightTheme.cardBg)).toBeGreaterThanOrEqual(AA_TEXT)
    expect(contrast(brand[400], darkTheme.background)).toBeGreaterThanOrEqual(AA_TEXT)
    expect(contrast(brand[400], darkTheme.cardBg)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  describe.each(themes)('tema %s', (_name, theme) => {
    it('texto principal sobre o fundo e sobre o card', () => {
      expect(contrast(theme.textPrimary, theme.background)).toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrast(theme.textPrimary, theme.cardBg)).toBeGreaterThanOrEqual(AA_TEXT)
    })

    it('texto secundário sobre o fundo e sobre o card', () => {
      expect(contrast(theme.textSecondary, theme.background)).toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrast(theme.textSecondary, theme.cardBg)).toBeGreaterThanOrEqual(AA_TEXT)
    })

    it('texto de apoio (muted) atinge ao menos o mínimo de texto grande', () => {
      expect(contrast(theme.muted, theme.background)).toBeGreaterThanOrEqual(AA_LARGE)
    })

    it('texto sobre os botões preenchidos', () => {
      expect(contrast(theme.onAccentText, theme.primary)).toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrast(theme.onAccentText, theme.danger)).toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrast(theme.onAccentText, theme.success)).toBeGreaterThanOrEqual(AA_TEXT)
    })

    it('cor do botão outline sobre o fundo', () => {
      expect(contrast(theme.primary, theme.background)).toBeGreaterThanOrEqual(AA_TEXT)
    })

    it('borda distinguível do fundo', () => {
      expect(contrast(theme.border, theme.background)).toBeGreaterThan(1.1)
    })
  })
})

describe('identidade visual da retaguarda NewHope', () => {
  // Este bloco é o contrato da padronização: a retaguarda do HopeDesk usa a
  // MESMA paleta da retaguarda do HopeSell. Se um destes valores mudar sem que
  // `HopeSell/packages/shared/tailwind-preset.js` tenha mudado junto, os dois
  // produtos deixaram de combinar.
  it('usa o verde-esperança e o neutro azulado do preset compartilhado', () => {
    expect(brand[700]).toBe('#0d7f57')
    expect(brand[400]).toBe('#57d6a1')
    expect(slate[950]).toBe('#07111f')
    expect(slate[900]).toBe('#0c192a')
    expect(slate[200]).toBe('#dce5ec')
  })

  it('a noite do escuro é o azul-noite comum ao HopeCash e ao HopeNoc', () => {
    expect(darkTheme.background).toBe(slate[950])
    expect(darkTheme.cardBg).toBe(slate[900])
  })

  it('a ação é o verde da marca, no degrau de cada tema', () => {
    expect(lightTheme.primary).toBe(brand[700])
    expect(darkTheme.primary).toBe(brand[400])
  })

  it('documenta por que o escuro não pode reusar o degrau do claro', () => {
    // Se algum dia isto passar de 4,5, o degrau clareado deixou de ser
    // necessário e o tema escuro pode voltar ao `brand-700`.
    expect(contrast(brand[700], darkTheme.background)).toBeLessThan(AA_TEXT)
    expect(contrast(darkTheme.primary, darkTheme.background)).toBeGreaterThanOrEqual(AA_TEXT)
  })
})
