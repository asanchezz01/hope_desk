import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { formatInteger } from '../../domain/format'
import { useTheme } from '../../theme/ThemeContext'
import EmptyState from '../EmptyState'

export interface BarListItem {
  key: string
  label: string
  value: number
  /** Texto exibido no lugar do número bruto (horas, percentual…). */
  valueLabel?: string
}

interface BarListProps {
  items: BarListItem[]
  /** Acima disso, o excedente é somado em "Outros" — nunca cores novas. */
  maxItems?: number
  emptyMessage?: string
}

/**
 * Ranking por grandeza, em barras horizontais.
 *
 * Uma hue só para todas as barras, de propósito: o comprimento já codifica a
 * magnitude, e colorir cada barra de um jeito seria duplo-encoding — gastaria o
 * único canal livre para repetir o que a barra já diz, e sugeriria identidade
 * onde há apenas ordem. Por ser série única, também não há legenda: o título do
 * bloco nomeia a série, e cada barra tem rótulo direto.
 */
export default function BarList({
  items,
  maxItems = 8,
  emptyMessage = 'Sem dados no período.',
}: BarListProps) {
  const theme = useTheme()

  if (items.length === 0) {
    return <EmptyState title="Nada a exibir" description={emptyMessage} />
  }

  const sorted = [...items].sort((a, b) => b.value - a.value)

  // Além do limite, o excedente vira uma linha "Outros" em vez de mais fatias:
  // a partir de ~8 classes as adjacentes deixam de ser distinguíveis.
  const visible = sorted.slice(0, maxItems)
  const overflow = sorted.slice(maxItems)
  const rows: BarListItem[] =
    overflow.length > 0
      ? [
          ...visible,
          {
            key: '__outros__',
            label: `Outros (${overflow.length})`,
            value: overflow.reduce((total, item) => total + item.value, 0),
          },
        ]
      : visible

  const max = Math.max(...rows.map((row) => row.value), 1)

  return (
    <View style={styles.list}>
      {rows.map((row) => {
        const ratio = Math.max(row.value / max, 0)
        const display = row.valueLabel ?? formatInteger(row.value)
        return (
          <View
            key={row.key}
            accessibilityRole="text"
            accessibilityLabel={`${row.label}: ${display}`}
            style={styles.row}
          >
            <View style={styles.rowHeader}>
              <Text numberOfLines={1} style={[styles.label, { color: theme.textPrimary }]}>
                {row.label}
              </Text>
              <Text style={[styles.value, { color: theme.textSecondary }]}>{display}</Text>
            </View>
            <View style={[styles.track, { backgroundColor: theme.chartTrack }]}>
              <View
                style={[
                  styles.bar,
                  // Barra de largura zero some; um mínimo mantém a linha legível
                  // quando o valor é pequeno mas não nulo.
                  { width: `${Math.max(ratio * 100, row.value > 0 ? 2 : 0)}%` },
                  { backgroundColor: theme.chartMagnitude },
                ]}
              />
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: { gap: 4 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { flex: 1, fontSize: 13 },
  value: { fontSize: 13, fontWeight: '600' },
  // Marca fina, sem borda: o trilho recessivo já separa a barra da superfície.
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
})
