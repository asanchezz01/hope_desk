/**
 * Contraste do tema (WCAG 2.1 AA).
 *
 * A Fase 08 pede "acessibilidade básica e contraste". Contraste é verificável,
 * então é teste — não inspeção visual. O alvo é 4,5:1 para texto normal e 3:1
 * para elementos gráficos e texto grande.
 *
 * Estes números são o motivo de `palette` (cores canônicas do legado) ser
 * separado das variantes de uso: #0c4e9a sobre o fundo escuro dá 1,9:1, e
 * #ffcc00 sobre branco dá 1,6:1. As duas seriam ilegíveis como cor de texto.
 */
import { darkTheme, lightTheme, LEGACY_PALETTE, type ThemeColors } from './ThemeContext'

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

describe('identidade visual', () => {
  it('preserva as cinco cores do legado, iguais nos dois temas', () => {
    const legado = {
      primary: '#0c4e9a',
      secondary: '#234783',
      accent: '#ffcc00',
      danger: '#d92120',
      success: '#1f9d55',
    }
    expect(LEGACY_PALETTE).toEqual(legado)
    expect(lightTheme.palette).toEqual(legado)
    expect(darkTheme.palette).toEqual(legado)
  })

  it('usa a cor canônica direto no tema claro', () => {
    expect(lightTheme.primary).toBe(LEGACY_PALETTE.primary)
    expect(lightTheme.danger).toBe(LEGACY_PALETTE.danger)
  })

  it('documenta por que o escuro não pode usar a cor canônica como texto', () => {
    // Se algum dia isto passar de 4,5, a variante clareada deixou de ser
    // necessária e o tema escuro pode voltar à cor canônica.
    expect(contrast(LEGACY_PALETTE.primary, darkTheme.background)).toBeLessThan(AA_TEXT)
    expect(contrast(darkTheme.primary, darkTheme.background)).toBeGreaterThanOrEqual(AA_TEXT)
  })
})
