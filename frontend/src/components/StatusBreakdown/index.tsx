import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { formatInteger, formatPercent } from '../../domain/format'
import { statusLabel } from '../../domain/ticket-status'
import { useIsDark, useTheme } from '../../theme/ThemeContext'
import { statusChartColor } from '../../theme/chart-palette'
import EmptyState from '../EmptyState'

export interface StatusSlice {
  key: string
  label: string
  count: number
}

interface StatusBreakdownProps {
  slices: StatusSlice[]
}

/**
 * Distribuição por situação, como barra empilhada de parte-do-todo.
 *
 * Escolhas registradas:
 *
 * - Barra empilhada, não pizza. São 4 segmentos e a leitura pretendida é
 *   "quanto de cada um no total"; pizza só ganharia se as fatias fossem bem
 *   distintas, e comparar valores próximos em ângulo é pior que em comprimento.
 * - **Rótulo e contagem sempre visíveis.** Não é enfeite: `#ffcc00` tem 1,47:1
 *   contra a superfície clara e `#234783` 1,91:1 contra a escura — abaixo de
 *   3:1. O validador de paleta trata esse aviso como obrigação de alívio por
 *   rótulo, então nenhuma informação aqui depende só da cor.
 * - Separação entre segmentos por VÃO da cor da superfície, não por borda.
 */
export default function StatusBreakdown({ slices }: StatusBreakdownProps) {
  const theme = useTheme()
  const isDark = useIsDark()

  const total = slices.reduce((sum, slice) => sum + slice.count, 0)

  if (total === 0) {
    return <EmptyState title="Nada a exibir" description="Nenhum chamado no período." />
  }

  const present = slices.filter((slice) => slice.count > 0)

  return (
    <View style={styles.container}>
      <View
        accessibilityRole="text"
        accessibilityLabel={present
          .map((slice) => `${slice.label}: ${slice.count} (${formatPercent(slice.count, total)})`)
          .join(', ')}
        style={styles.bar}
      >
        {present.map((slice, index) => (
          <View
            key={slice.key}
            style={[
              styles.segment,
              {
                flexGrow: slice.count,
                backgroundColor: statusChartColor(slice.key, isDark),
                // Vão da cor da superfície entre segmentos — não borda.
                marginLeft: index === 0 ? 0 : 2,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.legend}>
        {slices.map((slice) => (
          <View key={slice.key} style={styles.legendItem}>
            <View
              style={[styles.swatch, { backgroundColor: statusChartColor(slice.key, isDark) }]}
            />
            <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>
              {slice.label || statusLabel(slice.key)}
            </Text>
            <Text style={[styles.legendValue, { color: theme.textPrimary }]}>
              {formatInteger(slice.count)}
            </Text>
            <Text style={[styles.legendPercent, { color: theme.muted }]}>
              {formatPercent(slice.count, total)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
  segment: { height: 12 },
  legend: { gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: 13 },
  legendValue: { fontSize: 13, fontWeight: '700' },
  legendPercent: { fontSize: 12, minWidth: 40, textAlign: 'right' },
})
