import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { TextStyle } from 'react-native'

import { statusColor, statusLabel } from '../../domain/ticket-status'
import { useTheme } from '../../theme/ThemeContext'

interface StatusBadgeProps {
  status: string
  /** Sobrescreve o rótulo derivado do status. */
  label?: string
  style?: TextStyle
}

/**
 * A cor canônica do legado fica no marcador, não no texto: #ffcc00 como cor de
 * texto é ilegível no claro, e #234783 é ilegível no escuro. O texto usa a cor
 * do tema, o que garante contraste nos dois modos, e o significado nunca
 * depende só da cor — o rótulo sempre acompanha.
 */
export default function StatusBadge({ status, label, style }: StatusBadgeProps) {
  const theme = useTheme()
  const text = label ?? statusLabel(status)

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Status: ${text}`}
      style={[styles.badge, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
    >
      <View style={[styles.marker, { backgroundColor: statusColor(status) }]} />
      <Text style={[styles.text, { color: theme.textPrimary }, style as TextStyle]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  marker: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '600' },
})
