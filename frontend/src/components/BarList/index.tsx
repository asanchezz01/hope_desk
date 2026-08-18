import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { formatInteger } from '../../domain/format'
import { useTheme } from '../../theme/ThemeContext'
import { DIMMED_OPACITY } from '../../theme/chart-palette'
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
  /** Chave em foco; as outras linhas esmaecem. */
  selectedKey?: string | null
  /** Torna as linhas clicáveis, para recortar o painel por esta dimensão. */
  onSelect?: (key: string) => void
}

/** A cauda dobrada não é uma categoria — não dá para filtrar por "Outros". */
const OVERFLOW_KEY = '__outros__'

/**
 * Ranking por grandeza, em barras horizontais.
 *
 * Uma hue só para todas as barras, de propósito: o comprimento já codifica a
 * magnitude, e colorir cada barra de um jeito seria duplo-encoding — gastaria o
 * único canal livre para repetir o que a barra já diz, e sugeriria identidade
 * onde há apenas ordem. É onde este painel diverge do legado, que sorteava uma
 * cor de uma lista de 12 para cada módulo e técnico. Por ser série única
 * também não há legenda: o título do bloco nomeia a série, e cada barra tem
 * rótulo direto.
 *
 * Com `onSelect` cada linha vira o controle de filtro daquela categoria, com o
 * mesmo comportamento de interruptor dos gráficos.
 */
export default function BarList({
  items,
  maxItems = 8,
  emptyMessage = 'Sem dados no período.',
  selectedKey = null,
  onSelect,
}: BarListProps) {
  const theme = useTheme()
  const [hovered, setHovered] = useState<string | null>(null)

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
            key: OVERFLOW_KEY,
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
        const selectable = onSelect !== undefined && row.key !== OVERFLOW_KEY
        const selected = selectedKey === row.key
        const dimmed = selectedKey !== null && !selected

        return (
          <Pressable
            key={row.key}
            accessibilityRole={selectable ? 'button' : 'text'}
            accessibilityState={selectable ? { selected } : undefined}
            accessibilityLabel={`${row.label}: ${display}`}
            accessibilityHint={selectable ? 'Filtra o painel por esta categoria' : undefined}
            disabled={!selectable}
            onPress={selectable ? () => onSelect?.(row.key) : undefined}
            onHoverIn={() => setHovered(row.key)}
            onHoverOut={() => setHovered(null)}
            style={[
              styles.row,
              selectable && styles.rowSelectable,
              selected && { backgroundColor: theme.chartTrack },
              selectable &&
                hovered === row.key &&
                !selected && { backgroundColor: theme.background },
            ]}
          >
            <View style={styles.rowHeader}>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color: selected ? theme.textPrimary : theme.textSecondary },
                  selected && styles.labelSelected,
                ]}
              >
                {row.label}
              </Text>
              <Text style={[styles.value, { color: theme.textPrimary }]}>{display}</Text>
            </View>
            <View style={[styles.track, { backgroundColor: theme.chartTrack }]}>
              <View
                style={[
                  styles.bar,
                  // Barra de largura zero some; um mínimo mantém a linha legível
                  // quando o valor é pequeno mas não nulo.
                  { width: `${Math.max(ratio * 100, row.value > 0 ? 2 : 0)}%` },
                  { backgroundColor: theme.chartMagnitude, opacity: dimmed ? DIMMED_OPACITY : 1 },
                ]}
              />
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: 6 },
  row: { gap: 5, paddingVertical: 5 },
  // Alvo maior que a marca: a linha inteira responde, não só a barra de 8px.
  rowSelectable: { paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 8, minHeight: 44 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { flex: 1, fontSize: 13 },
  labelSelected: { fontWeight: '700' },
  value: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  // Marca fina, sem borda: o trilho recessivo já separa a barra da superfície.
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
})
