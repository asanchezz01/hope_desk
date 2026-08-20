// src/theme/tokens.ts — design tokens for HopeDesk frontend app
import { Platform } from 'react-native'

export const Colors = {
  // Primary palette (legacy colors preserved)
  primary: '#0c4e9a',
  secondary: '#234783',
  accent: '#ffcc00',
  danger: '#d92120',
  success: '#1f9d55',

  // Semantic usage tokens
  brand: {
    primary: '#0c4e9a', // Main branding, headers, action buttons
    secondary: '#234783', // Secondary branding, navigation items
    accent: '#ffcc00', // Highlights, badges, accents
  },

  semantic: {
    danger: '#d92120', // Errors, urgent status
    success: '#1f9d55', // Completed/success states
    warning: '#ff8c00', // Warning states
    info: '#3b82f6', // Info states
  },

  grayscale: {
    white: '#ffffff',
    nearWhite: '#fafafa',
    lightest: '#f3f4f6',
    lighter: '#e5e7eb',
    light: '#d1d5db', // borders
    medium: '#9ca3af', // muted text, secondary labels
    dark: '#4b5563', // primary text in light mode
    nearBlack: '#1f2937', // headings in light mode
    black: '#111827', // fallback for absolute black
  },

  transparent: {
    overlay: 'rgba(0,0,0,0.4)', // modal backdrop
    badge: 'rgba(0,0,0,0.06)', // subtle hover state
  },
} as const

// Status badge palette (from ANALYTICS_STATUS_META in backend)
export const StatusColors = {
  aberto: {
    // Em aberto — urgent
    bg: 'rgba(217,33,32,0.08)',
    border: '#d92120',
    text: '#b91c1b',
  },
  em_andamento: {
    // In progress
    bg: 'rgba(255,204,0,0.08)',
    border: '#eab308',
    text: '#854d0e',
  },
  resolvido: {
    // Done
    bg: 'rgba(31,157,85,0.08)',
    border: '#1f9d55',
    text: '#15803d',
  },
  fechado: {
    // Closed
    bg: 'rgba(35,71,131,0.08)',
    border: '#234783',
    text: Colors.grayscale.dark,
  },
  default: {
    // Fallback
    bg: 'rgba(156,163,175,0.08)',
    border: '#9ca3af',
    text: Colors.grayscale.dark,
  },
} as const

// Spacing scale (4px base)
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

// Border Radius scale
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const

// Font scales
export const Typography = {
  screenTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 24,
  },
  heading1: {
    fontSize: Platform.select({ web: 32, default: 28 }),
    fontWeight: '700' as const,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  heading2: {
    fontSize: Platform.select({ web: 24, default: 20 }),
    fontWeight: '600' as const,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  heading3: {
    fontSize: Platform.select({ web: 20, default: 18 }),
    fontWeight: '500' as const,
    lineHeight: 26,
  },
  body: {
    fontSize: Platform.select({ web: 16, default: 14 }),
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  caption: {
    fontSize: Platform.select({ web: 13, default: 12 }),
    fontWeight: '400' as const,
    lineHeight: 18,
  },
} as const

// Shadows (native + web)
export const Shadows = {
  shadow1: Platform.select({
    web: { boxShadow: '0px 1px 4px rgba(0,0,0,0.1)' },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    },
  }) as Record<string, unknown>,
  shadow2: Platform.select({
    web: { boxShadow: '0px 2px 8px rgba(0,0,0,0.12)' },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 5,
    },
  }) as Record<string, unknown>,
} as const

// Safe area and window metrics
// For web, use CSS media queries or a custom hook; here we provide platform-safe defaults.
export const PlatformPadding = {
  safeBottom: Platform.select({ default: Spacing.md, web: 0 }) ?? Spacing.md,
} as const
