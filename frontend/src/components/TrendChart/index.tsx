import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { formatInteger } from '../../domain/format'
import { useTheme } from '../../theme/ThemeContext'
import EmptyState from '../EmptyState'

export interface TrendPoint {
  label: string
  value: number
}

interface TrendChartProps {
  points: TrendPoint[]
  /** Nome da grandeza, usado na descrição acessível. */
  measure: string
}

/**
 * Série única ao longo do tempo, em barras verticais finas.
 *
 * Uma grandeza, um eixo. Sobrepor chamados e horas no mesmo gráfico exigiria
 * duas escalas — o erro que inventa correlação onde não há. Quando as duas
 * grandezas interessam, são dois gráficos lado a lado, cada um com sua escala.
 *
 * Rotulagem seletiva: só o maior ponto e o último recebem número. Um valor sobre
 * cada barra vira ruído e não é lido.
 */
export default function TrendChart({ points, measure }: TrendChartProps) {
  const theme = useTheme()

  if (points.length === 0) {
    return <EmptyState bare title="Nada a exibir" description="Sem histórico no período." />
  }

  const max = Math.max(...points.map((point) => point.value), 1)
  const maxIndex = points.reduce(
    (best, point, index) => (point.value > points[best].value ? index : best),
    0
  )
  const lastIndex = points.length - 1

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Tendência de ${measure}: ${points
        .map((point) => `${point.label} ${formatInteger(point.value)}`)
        .join(', ')}`}
      style={styles.container}
    >
      <View style={styles.plot}>
        {points.map((point, index) => {
          const highlighted = index === maxIndex || index === lastIndex
          const ratio = point.value / max
          return (
            <View key={`${point.label}-${index}`} style={styles.column}>
              <Text
                style={[
                  styles.value,
                  { color: theme.textSecondary },
                  !highlighted && styles.valueHidden,
                ]}
              >
                {formatInteger(point.value)}
              </Text>
              <View style={styles.barArea}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${Math.max(ratio * 100, point.value > 0 ? 3 : 0)}%`,
                      backgroundColor: theme.chartMagnitude,
                    },
                  ]}
                />
              </View>
              <Text numberOfLines={1} style={[styles.label, { color: theme.muted }]}>
                {point.label}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 150 },
  column: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  value: { fontSize: 10, fontWeight: '700' },
  // Mantém a altura reservada: sem isto as colunas rotuladas ficariam mais
  // baixas que as demais e a base do gráfico ondularia.
  valueHidden: { opacity: 0 },
  barArea: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '70%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  label: { fontSize: 10 },
})
