import { FontAwesome6 } from '@expo/vector-icons'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../../theme/ThemeContext'
import { Radius } from '../../theme/tokens'
import Button from '../Button'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  /** Glyph do FontAwesome6 no disco. Decorativo — o texto é quem explica. */
  icon?: React.ComponentProps<typeof FontAwesome6>['name']
  /**
   * Sem moldura nem fundo. É o caso de dentro de um cartão (um gráfico sem
   * dados): a caixa tracejada ali vira cartão dentro de cartão.
   */
  bare?: boolean
}

/**
 * Caixa de contorno tracejado do padrão da retaguarda. O tracejado é o sinal:
 * diz "aqui caberia conteúdo" sem parecer um cartão de verdade que por acaso
 * está vazio.
 */
export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = 'inbox',
  bare = false,
}: EmptyStateProps) {
  const theme = useTheme()
  return (
    <View
      style={[
        styles.container,
        bare
          ? styles.bare
          : { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.cardBg },
      ]}
    >
      <View style={[styles.disc, { backgroundColor: theme.surfaceMuted }]}>
        <FontAwesome6 name={icon} size={20} color={theme.muted} />
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
        {title}
      </Text>
      <Text style={[styles.description, { color: theme.muted }]}>{description}</Text>
      {actionLabel && onAction && (
        <View style={styles.action}>
          <Button title={actionLabel} onPress={onAction} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
    padding: 40,
    borderStyle: 'dashed',
    borderRadius: Radius.xl,
  },
  bare: { padding: 24 },
  disc: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  description: { fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 420 },
  action: { marginTop: 12 },
})
