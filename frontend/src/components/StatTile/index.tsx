import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../../theme/ThemeContext'

interface StatTileProps {
  label: string
  value: string
  /** Linha de apoio: comparação, recorte ou unidade. */
  hint?: string
}

/**
 * Número em destaque.
 *
 * Quando a história é um número só, ele É o gráfico — um gráfico de barra única
 * ou uma pizza de duas fatias diriam menos ocupando mais espaço.
 */
export default function StatTile({ label, value, hint }: StatTileProps) {
  const theme = useTheme()

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${value}${hint ? `. ${hint}` : ''}`}
      style={[styles.tile, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
    >
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      {/* O número usa cor de TEXTO, não a cor da série: identidade fica com a
          marca colorida ao lado, nunca com o texto. */}
      <Text style={[styles.value, { color: theme.textPrimary }]}>{value}</Text>
      {hint && <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: 150,
    gap: 2,
    padding: 14,
    borderWidth: 1,
    borderRadius: 12,
  },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 26, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 16 },
})
