import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, G } from 'react-native-svg'

import { formatInteger, formatPercent } from '../../domain/format'
import { useTheme } from '../../theme/ThemeContext'
import { DIMMED_OPACITY } from '../../theme/chart-palette'
import EmptyState from '../EmptyState'

import { useReveal } from './useReveal'

export interface DonutSlice {
  key: string
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  slices: DonutSlice[]
  /** Rótulo do número central — o total, não uma fatia. */
  centerLabel: string
  /** Chave em foco; as outras fatias esmaecem. */
  selectedKey?: string | null
  onSelect?: (key: string) => void
  emptyMessage?: string
}

const SIZE = 168
const STROKE = 26
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** Vão de 2px na cor da superfície entre fatias — separação sem borda. */
const GAP = 2

/**
 * Parte-do-todo em anel, com o total no miolo.
 *
 * Anel e não pizza: o buraco do meio devolve o espaço para o número que
 * realmente lidera a leitura ("quantos chamados ao todo"), e a comparação entre
 * fatias fica com a legenda, que traz contagem e percentual em texto. É a
 * ressalva que o anel exige — ângulos próximos são indistinguíveis, então
 * nenhuma comparação depende só do desenho.
 *
 * São 4 fatias fixas (os status), dentro do limite de ~6 em que a leitura em
 * ângulo ainda funciona. Passar disso viraria barra.
 */
export default function DonutChart({
  slices,
  centerLabel,
  selectedKey = null,
  onSelect,
  emptyMessage = 'Nenhum chamado no período.',
}: DonutChartProps) {
  const theme = useTheme()
  const [hovered, setHovered] = useState<string | null>(null)

  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const present = slices.filter((slice) => slice.value > 0)
  const progress = useReveal(`${total}-${slices.map((s) => s.value).join(',')}`)

  if (total === 0) {
    return <EmptyState title="Nada a exibir" description={emptyMessage} />
  }

  let cursor = 0
  const arcs = present.map((slice) => {
    const fraction = slice.value / total
    const arc = { slice, fraction, offset: cursor }
    cursor += fraction
    return arc
  })

  const opacityFor = (key: string) => {
    if (selectedKey !== null) return selectedKey === key ? 1 : DIMMED_OPACITY
    if (hovered !== null) return hovered === key ? 1 : 0.45
    return 1
  }

  return (
    <View style={styles.container}>
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE} accessibilityRole="image">
          {/* Começa às 12 horas: girar o grupo é mais barato que recalcular
              cada deslocamento a partir das 3 horas, que é onde o SVG começa. */}
          <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
            {/* Trilho: mantém o anel visível enquanto a varredura acontece e
                fecha a circunferência quando uma fatia é a única do recorte. */}
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={theme.chartTrack}
              strokeWidth={STROKE}
              fill="none"
            />
            {arcs.map(({ slice, fraction, offset }) => {
              const length = Math.max(fraction * CIRCUMFERENCE * progress - GAP, 0)
              return (
                <Circle
                  key={slice.key}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  stroke={slice.color}
                  strokeWidth={STROKE}
                  strokeLinecap="butt"
                  fill="none"
                  opacity={opacityFor(slice.key)}
                  strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                  strokeDashoffset={-offset * CIRCUMFERENCE * progress}
                  onPress={onSelect ? () => onSelect(slice.key) : undefined}
                />
              )
            })}
          </G>
        </Svg>

        <View pointerEvents="none" style={styles.center}>
          <Text style={[styles.centerValue, { color: theme.textPrimary }]}>
            {formatInteger(total)}
          </Text>
          <Text style={[styles.centerLabel, { color: theme.muted }]}>{centerLabel}</Text>
        </View>
      </View>

      {/* A legenda É o controle: cada linha tem alvo grande, foco de teclado e
          traz contagem e percentual em texto — a leitura não depende da cor,
          que é a compensação obrigatória do aviso de contraste do #ffcc00. */}
      <View style={styles.legend}>
        {slices.map((slice) => {
          const selected = selectedKey === slice.key
          return (
            <Pressable
              key={slice.key}
              accessibilityRole={onSelect ? 'button' : 'text'}
              accessibilityState={onSelect ? { selected } : undefined}
              accessibilityLabel={`${slice.label}: ${formatInteger(slice.value)} chamados, ${formatPercent(slice.value, total)}${onSelect ? '. Toque para filtrar o painel.' : ''}`}
              disabled={!onSelect}
              onPress={onSelect ? () => onSelect(slice.key) : undefined}
              onHoverIn={() => setHovered(slice.key)}
              onHoverOut={() => setHovered(null)}
              style={[
                styles.legendRow,
                selected && { backgroundColor: theme.chartTrack },
                hovered === slice.key && !selected && { backgroundColor: theme.background },
              ]}
            >
              <View style={[styles.swatch, { backgroundColor: slice.color }]} />
              <Text numberOfLines={1} style={[styles.legendLabel, { color: theme.textSecondary }]}>
                {slice.label}
              </Text>
              <Text style={[styles.legendValue, { color: theme.textPrimary }]}>
                {formatInteger(slice.value)}
              </Text>
              <Text style={[styles.legendPercent, { color: theme.muted }]}>
                {formatPercent(slice.value, total)}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 16, alignItems: 'center' },
  ringWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  // Figuras proporcionais, não tabulares: num número grande e isolado o dígito
  // de largura fixa deixa "121" frouxo.
  centerValue: { fontSize: 34, fontWeight: '700', lineHeight: 38 },
  centerLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  legend: { alignSelf: 'stretch', gap: 2 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 32,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: 13 },
  legendValue: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  legendPercent: { fontSize: 12, minWidth: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
})
