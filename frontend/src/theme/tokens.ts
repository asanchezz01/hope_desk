// Tokens visuais da retaguarda NewHope.
//
// ## De onde vêm
//
// Estes valores são a porta de entrada, em React Native, do preset que a
// retaguarda do HopeSell usa no Tailwind:
//
//     HopeSell/packages/shared/tailwind-preset.js
//
// Esse arquivo é a FONTE canônica do padrão visual dos módulos de retaguarda da
// NewHope (HopeSell, HopeDesk e os próximos). HopeCash, HopeNoc e HopeSite têm
// proposta própria e ficam de fora. Quando um degrau mudar lá, mude aqui — os
// dois repositórios são separados, então a sincronia é manual e proposital: não
// vale a pena um pacote publicado para nove escalas de cor.
//
// As escalas nasceram do design system do HopeCash (`night`, `hope-green`,
// `public-mint`, `focus-gold`, `information-blue`...) e do tema do HopeNoc
// (`--bg: #07111f`, `--superficie: #0c192a`, `--linha: #203753`). É o azul-noite
// `#07111f` comum aos dois que dá o parentesco entre os produtos.
import { Platform } from 'react-native'

/** Neutro azulado: papel do HopeCash em cima, noite do NOC embaixo. */
export const slate = {
  50: '#f5f8fa',
  100: '#eef3f8',
  200: '#dce5ec',
  300: '#c2d0dd',
  400: '#8ba0b4',
  500: '#576d84',
  600: '#4a5f78',
  700: '#374d64',
  800: '#203753',
  900: '#0c192a',
  950: '#07111f',
} as const

/** Verde-esperança. 700 é a ação sobre papel; 400 é a voz sobre a noite. */
export const brand = {
  50: '#e9f7f1',
  100: '#d9f0e5',
  200: '#a9e0c8',
  300: '#7ad3ae',
  400: '#57d6a1',
  500: '#3dd598',
  600: '#12a271',
  700: '#0d7f57',
  800: '#0a6344',
  900: '#063824',
  950: '#04231a',
} as const

/** Ouro de foco / âmbar de atenção, para destaque comercial. */
export const accent = {
  50: '#fdf6e8',
  100: '#faeacb',
  200: '#f7d996',
  300: '#f7d08a',
  400: '#f2bc62',
  500: '#e0a23c',
  600: '#a2600b',
  700: '#854f09',
  800: '#6a3f07',
  900: '#4f2f06',
  950: '#3d2408',
} as const

/** Verde semântico (sucesso) — mesma família do brand para não brigar com ele. */
export const green = {
  50: '#e9f7f1',
  100: '#d9f0e5',
  400: '#34d399',
  500: '#16b581',
  600: '#0f9a6a',
  700: '#0d7f57',
  900: '#063824',
} as const

/** Azul de informação. */
export const blue = {
  50: '#eaf1fe',
  100: '#d5e2fd',
  400: '#38bdf8',
  500: '#3b74e8',
  600: '#1f5fe0',
  700: '#1a4fbb',
  900: '#12295c',
} as const

/** Âmbar de atenção. */
export const amber = {
  50: '#fdf6e8',
  100: '#faeacb',
  400: '#fbbf24',
  500: '#d99a12',
  600: '#a2600b',
  700: '#8a5209',
  900: '#452a05',
} as const

/** Vermelho de saída/erro. */
export const red = {
  50: '#fbeeee',
  100: '#f7dcdc',
  400: '#fb7185',
  500: '#d24d4d',
  600: '#b03a3a',
  700: '#922f2f',
  900: '#4a1818',
} as const

/** Roxo de patrimônio — categoria, nunca decoração. */
export const violet = {
  50: '#f0ecfb',
  100: '#e2daf7',
  400: '#9b7ce0',
  600: '#6b4cc9',
  900: '#2f2158',
} as const

/** Escala de espaçamento, base 4px — a mesma do Tailwind usado no HopeSell. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

/**
 * Geometria do HopeCash, herdada pelo preset: controle 12px, cartão 16px,
 * contêiner 20–24px. Os nomes acompanham as classes do Tailwind (`rounded-lg`
 * é 12px no preset, não os 8px de fábrica) para que os dois lados combinem.
 */
export const Radius = {
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const

/**
 * Tipografia da retaguarda.
 *
 * A retaguarda do HopeSell é dominada por 14px (`text-sm`): é uma interface de
 * lista e formulário, onde caber mais linha na tela vale mais que corpo grande.
 *
 * ponytail: a família (Hanken Grotesk no HopeSell) fica só no `+html.tsx`, para
 * o que o navegador desenha direto. O react-native-web escreve a pilha de fonte
 * do sistema numa classe atômica por `<Text>`, e sobrescrevê-la globalmente com
 * `!important` quebraria os glifos do @expo/vector-icons, que são `<Text>` com
 * fontFamily própria. Para valer em toda a árvore: carregar a fonte com
 * `expo-font` e passar `fontFamily` aqui em cada entrada.
 */
export const Typography = {
  /** Título da página, no cabeçalho de conteúdo. `text-xl font-bold`. */
  pageTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  /** Linha de apoio sob o título. `text-sm`. */
  pageSubtitle: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  /** Cabeçalho de cartão/seção. `text-sm font-semibold`. */
  sectionTitle: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  heading1: {
    fontSize: Platform.select({ web: 24, default: 22 }),
    fontWeight: '700' as const,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  heading2: {
    fontSize: Platform.select({ web: 18, default: 17 }),
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  heading3: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  /** Rótulo de campo e de item de menu. `text-sm font-medium`. */
  label: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  /** Título de seção do menu lateral. `text-[0.68rem] font-bold uppercase`. */
  eyebrow: {
    fontSize: 11,
    fontWeight: '700' as const,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
} as const

/**
 * Sombra rara e tingida de azul-noite — no padrão a separação vem de contorno
 * mais contraste tonal, e a sombra é só um reforço no tema claro.
 */
export const Shadows = {
  card: Platform.select({
    web: { boxShadow: '0 1px 2px 0 rgba(7,17,31,0.05), 0 1px 3px 0 rgba(7,17,31,0.07)' },
    default: {
      shadowColor: slate[950],
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.07,
      shadowRadius: 3,
      elevation: 2,
    },
  }) as Record<string, unknown>,
  raised: Platform.select({
    web: { boxShadow: '0 10px 26px -6px rgba(7,17,31,0.14), 0 4px 10px -4px rgba(7,17,31,0.08)' },
    default: {
      shadowColor: slate[950],
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.14,
      shadowRadius: 12,
      elevation: 6,
    },
  }) as Record<string, unknown>,
  /** Sombra verde sob a ação primária — o `shadow-acao` do preset. */
  acao: Platform.select({
    web: { boxShadow: '0 10px 26px rgba(13,127,87,0.22)' },
    default: {
      shadowColor: brand[700],
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 12,
      elevation: 4,
    },
  }) as Record<string, unknown>,
} as const

export const PlatformPadding = {
  safeBottom: Platform.select({ default: Spacing.md, web: 0 }) ?? Spacing.md,
} as const
