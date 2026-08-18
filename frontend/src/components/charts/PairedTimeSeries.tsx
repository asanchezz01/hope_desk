import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../../theme/ThemeContext'

import TimeSeriesChart, { type SeriesPoint } from './TimeSeriesChart'

interface PairedTimeSeriesProps {
  /** Série de contagem — desenhada em colunas, em cima. */
  countPoints: SeriesPoint[]
  countLabel: string
  countColor: string
  formatCount: (value: number) => string
  /** Série contínua — desenhada em área, embaixo, com o mesmo eixo x. */
  amountPoints: SeriesPoint[]
  amountLabel: string
  amountColor: string
  formatAmount: (value: number) => string
  selectedKey?: string | null
  onSelect?: (key: string) => void
}

/**
 * Duas grandezas, um eixo x, um cursor — a substituição honesta do gráfico de
 * eixo duplo do legado.
 *
 * O painel antigo punha "chamados abertos" (0–20) e "horas trabalhadas"
 * (0–400) no mesmo desenho, com uma escala em cada lado. As duas escalas eram
 * ancoradas em pontos arbitrários, e disso saía uma correlação visual que o
 * dado não sustenta: bastava mexer no topo de um eixo para as curvas
 * "concordarem" ou "discordarem". É o erro de gráfico mais comum que existe.
 *
 * O que o eixo duplo tentava dar de útil era comparar o MESMO instante nas duas
 * séries. Isso se resolve com painéis empilhados: mesmo eixo x, mesma largura
 * de faixa, e um cursor que atravessa os dois — passar o mouse em março marca
 * março nos dois gráficos ao mesmo tempo. A leitura fica, o erro sai.
 *
 * Formas diferentes de propósito: contagem é discreta e ganha colunas; horas
 * são contínuas e ganham área. A forma já diz que são grandezas de naturezas
 * diferentes, antes de qualquer legenda.
 */
export default function PairedTimeSeries({
  countPoints,
  countLabel,
  countColor,
  formatCount,
  amountPoints,
  amountLabel,
  amountColor,
  formatAmount,
  selectedKey = null,
  onSelect,
}: PairedTimeSeriesProps) {
  const theme = useTheme()
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <View style={styles.container}>
      {/* Legenda sempre presente: são duas séries, e identidade nunca pode
          depender de o leitor lembrar qual cor era qual. */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendRect, { backgroundColor: countColor }]} />
          <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>{countLabel}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: amountColor }]} />
          <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>{amountLabel}</Text>
        </View>
      </View>

      <TimeSeriesChart
        points={countPoints}
        measure={countLabel}
        shape="columns"
        color={countColor}
        format={formatCount}
        height={150}
        hideAxisLabels
        selectedKey={selectedKey}
        onSelect={onSelect}
        hoveredIndex={hovered}
        onHoverIndex={setHovered}
      />

      <TimeSeriesChart
        points={amountPoints}
        measure={amountLabel}
        shape="area"
        color={amountColor}
        format={formatAmount}
        height={132}
        selectedKey={selectedKey}
        onSelect={onSelect}
        hoveredIndex={hovered}
        onHoverIndex={setHovered}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // A legenda espelha a marca: retângulo para colunas, traço para a linha.
  legendRect: { width: 10, height: 10, borderRadius: 3 },
  legendLine: { width: 14, height: 2, borderRadius: 1 },
  legendLabel: { fontSize: 12 },
})
