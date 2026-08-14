// Reexporta o tema (Fase 08). Ponto de import estável para os componentes.
export {
  ThemeProvider,
  useTheme,
  useThemeMode,
  lightTheme,
  darkTheme,
  LEGACY_PALETTE,
} from './ThemeContext'
export type { Palette, ThemeColors, ThemeMode } from './ThemeContext'
