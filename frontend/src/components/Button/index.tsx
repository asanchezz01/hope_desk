import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import type { ViewStyle } from 'react-native'

import { useTheme } from '../../theme/ThemeContext'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger'

interface ButtonProps {
  title: string
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  loading?: boolean
  /** Ocupa toda a largura disponível. */
  full?: boolean
  /** Sobrescreve o texto lido por leitores de tela. */
  accessibilityLabel?: string
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  full = false,
  accessibilityLabel,
}: ButtonProps) {
  const theme = useTheme()
  const inactive = disabled || loading

  // `onAccentText` acompanha o tema: no claro os preenchimentos são escuros e o
  // texto é branco; no escuro eles são claros e o texto precisa ser escuro.
  const { background, borderColor, textColor } = {
    primary: {
      background: theme.primary,
      borderColor: theme.primary,
      textColor: theme.onAccentText,
    },
    danger: {
      background: theme.danger,
      borderColor: theme.danger,
      textColor: theme.onAccentText,
    },
    secondary: {
      background: theme.cardBg,
      borderColor: theme.border,
      textColor: theme.textPrimary,
    },
    outline: {
      background: 'transparent',
      borderColor: theme.primary,
      textColor: theme.primary,
    },
  }[variant]

  const shape: ViewStyle = { backgroundColor: background, borderColor }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        shape,
        full && styles.full,
        pressed && !inactive && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator accessibilityLabel="Processando" color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    // 48 é o alvo de toque mínimo recomendado; abaixo disso o botão fica difícil
    // de acertar no celular.
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
  },
  full: { alignSelf: 'stretch' },
  pressed: { opacity: 0.85 },
  inactive: { opacity: 0.5 },
  text: { fontSize: 16, fontWeight: '600' },
})
