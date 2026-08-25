import React, { useMemo, useState } from 'react'
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg'

import { useTheme } from '../../theme/ThemeContext'
import { DIMMED_OPACITY } from '../../theme/chart-palette'
import EmptyState from '../EmptyState'

import ChartTooltip from './ChartTooltip'
import {
  alignedScales,
  closeAreaPath,
  roundedTopBarPath,
  smoothLinePath,
  type Point,
} from './geometry'
import { useReveal } from './useReveal'

export interface SeriesPoint {
  key: string
  label: string
  value: number
}

interface ComboTimeSeriesProps {
  /** Série de contagem — colunas, eixo da ESQUERDA. */
  countPoints: SeriesPoint[]
  countLabel: string
  countAxisLabel: string
  countColor: string
  formatCount: (value: number) => string
  /** Série contínua — linha com área, eixo da DIREITA. */
  amountPoints: SeriesPoint[]
  amountLabel: string
  amountAxisLabel: string
  amountColor: string
  formatAmount: (value: number) => string
  height?: number
  /** Chave em foco; as outras colunas esmaecem. */
  selectedKey?: string | null
  onSelect?: (key: string) => void
}

const PADDING_TOP = 22
const AXIS_BAND = 20
const LEFT_AXIS = 38
const RIGHT_AXIS = 48
const MAX_BAR_WIDTH = 24

/**
 * Colunas e linha SOBREPOSTAS, com um eixo de cada lado — o gráfico do painel
 * antigo.
 *
 * O que precisa estar dito, porque é a fraqueza conhecida desta forma: são
 * **duas escalas y**, e a razão entre elas é uma escolha de desenho, não um
 * fato do dado. Um pico de horas que "acompanha" um pico de chamados pode ser
 * só o efeito de onde cada eixo foi ancorado — mudando o topo de um deles, as
 * duas séries passam a concordar ou a discordar sem que nada tenha mudado nos
 * chamados. Comparar a FORMA das duas séries é leitura legítima; ler a
 * distância vertical entre elas não é.
 *
 * Três coisas reduzem o estrago sem tirar a sobreposição que a operação usa:
 *
 * 1. **Os dois eixos são rotulados** ("Chamados" à esquerda, "Horas" à
 *    direita). A dupla escala fica declarada, não escondida — no legado os
 *    números apareciam nos dois lados sem dizer de quem eram.
 * 2. **Uma grade só.** `alignedScales` obriga os dois eixos ao mesmo número de
 *    intervalos, então cada linha horizontal vale para os dois lados. Duas
 *    grades desencontradas é o que torna esse gráfico ilegível na prática.
 * 3. **Formas diferentes.** Contagem em coluna, grandeza contínua em linha com
 *    área: a forma já separa as séries antes de a cor precisar fazê-lo.
 */
export default function ComboTimeSeries({
  countPoints,
  countLabel,
  countAxisLabel,
  countColor,
  formatCount,
  amountPoints,
  amountLabel,
  amountAxisLabel,
  amountColor,
  formatAmount,
  height = 260,
  selectedKey = null,
  onSelect,
}: ComboTimeSeriesProps) {
  const theme = useTheme()
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)

  // A revelação interpola o VALOR, não a opacidade: as colunas sobem do eixo e
  // a curva sobe com elas, como o dado subiria — em vez de o gráfico pronto
  // simplesmente piscar na tela. Com "reduzir movimento" ligado já entra em 1.
  const progress = useReveal(
    `${countPoints.map((point) => point.value).join(',')}|${amountPoints
      .map((point) => point.value)
      .join(',')}`
  )

  const scales = useMemo(
    () =>
      alignedScales(
        Math.max(...countPoints.map((point) => point.value), 0),
        Math.max(...amountPoints.map((point) => point.value), 0)
      ),
    [countPoints, amountPoints]
  )

  if (countPoints.length === 0) {
    return <EmptyState bare title="Nada a exibir" description="Sem histórico no período." />
  }

  // A altura declarada JÁ INCLUI a faixa dos rótulos do eixo x. Dimensionar só
  // o desenho e deixar os rótulos vazarem cria aquele scroll minúsculo no card.
  const plotHeight = height - AXIS_BAND - PADDING_TOP
  const plotWidth = Math.max(width - LEFT_AXIS - RIGHT_AXIS, 0)
  const band = plotWidth / countPoints.length
  const baseline = PADDING_TOP + plotHeight

  const yCount = (value: number) => PADDING_TOP + plotHeight * (1 - value / scales.a.max)
  const yAmount = (value: number) => PADDING_TOP + plotHeight * (1 - value / scales.b.max)

  const linePoints: Point[] = amountPoints.map((point, index) => ({
    x: band * index + band / 2,
    y: yAmount(point.value * progress),
  }))
  const linePath = smoothLinePath(linePoints)
  const gradientId = `hd-combo-${countAxisLabel.replace(/\W/g, '')}`

  // Com muitas faixas os rótulos colidem; 1 em cada N é melhor que girar o
  // texto ou deixá-lo sobrepor o vizinho.
  const labelStep = Math.max(1, Math.ceil(countPoints.length / (plotWidth > 520 ? 12 : 6)))
  // A caixa do rótulo acompanha o ESPAÇO ENTRE rótulos exibidos, não a largura
  // de uma faixa: num mês de 31 dias no celular a faixa tem ~8px e "01/03"
  // saía como "0…". O piso de 34px garante a data legível; o teto de 64 impede
  // que rótulos vizinhos se toquem quando há poucos pontos.
  const labelWidth = Math.max(34, Math.min(band * labelStep, 64))

  return (
    <View style={styles.container}>
      {/* Legenda sempre presente: são duas séries, e identidade nunca pode
          depender de o leitor lembrar qual cor era qual. Ela espelha a marca —
          retângulo para as colunas, traço para a linha — e nomeia o eixo de
          cada uma, que é a informação que falta num gráfico de escala dupla. */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendRect, { backgroundColor: countColor }]} />
          <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>
            {countLabel} <Text style={{ color: theme.muted }}>(eixo esq.)</Text>
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: amountColor }]} />
          <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>
            {amountLabel} <Text style={{ color: theme.muted }}>(eixo dir.)</Text>
          </Text>
        </View>
      </View>

      <View
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        style={{ height }}
        accessibilityRole="text"
        accessibilityLabel={`${countLabel} e ${amountLabel} por período: ${countPoints
          .map(
            (point, index) =>
              `${point.label}, ${formatCount(point.value)} ${countAxisLabel}, ${formatAmount(
                amountPoints[index]?.value ?? 0
              )}`
          )
          .join('; ')}`}
      >
        {width > 0 && (
          <>
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  {/* Lavagem fraca, e não bloco: a área passa POR CIMA das
                      colunas, e um preenchimento pesado apagaria a série de
                      baixo — que é o dado principal do gráfico. */}
                  <Stop offset="0" stopColor={amountColor} stopOpacity={0.18} />
                  <Stop offset="1" stopColor={amountColor} stopOpacity={0.02} />
                </LinearGradient>
              </Defs>

              {/* UMA grade, válida para os dois eixos. Fio sólido de 1px, um
                  passo fora da superfície — nunca tracejada. */}
              {scales.a.ticks.map((tick) => (
                <Line
                  key={tick}
                  x1={LEFT_AXIS}
                  x2={width - RIGHT_AXIS}
                  y1={yCount(tick)}
                  y2={yCount(tick)}
                  stroke={theme.border}
                  strokeWidth={1}
                />
              ))}

              {/* Colunas primeiro: a linha passa por cima, como no legado. */}
              {countPoints.map((point, index) => {
                const barWidth = Math.min(band * 0.6, MAX_BAR_WIDTH)
                const top = yCount(point.value * progress)
                const path = roundedTopBarPath(
                  LEFT_AXIS + band * index + (band - barWidth) / 2,
                  top,
                  barWidth,
                  baseline - top
                )
                if (path === '') return null
                const dimmed = selectedKey !== null && selectedKey !== point.key
                return (
                  <Path
                    key={point.key}
                    d={path}
                    fill={countColor}
                    opacity={dimmed ? DIMMED_OPACITY : active === index ? 0.8 : 1}
                  />
                )
              })}

              <Path
                d={closeAreaPath(linePath, linePoints, baseline)}
                fill={`url(#${gradientId})`}
                translateX={LEFT_AXIS}
              />
              <Path
                d={linePath}
                stroke={amountColor}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                translateX={LEFT_AXIS}
              />

              {/* Cursor: o leitor mira numa data, não numa marca de 2px. */}
              {active !== null && (
                <>
                  <Line
                    x1={LEFT_AXIS + band * active + band / 2}
                    x2={LEFT_AXIS + band * active + band / 2}
                    y1={PADDING_TOP}
                    y2={baseline}
                    stroke={theme.muted}
                    strokeWidth={1}
                  />
                  {/* Anel de 2px na cor da superfície: sem ele o ponto some
                      onde cruza a própria linha ou o topo de uma coluna. */}
                  <Circle
                    cx={LEFT_AXIS + linePoints[active].x}
                    cy={linePoints[active].y}
                    r={4}
                    fill={amountColor}
                    stroke={theme.cardBg}
                    strokeWidth={2}
                  />
                </>
              )}
            </Svg>

            {/* Eixo da esquerda: contagem. */}
            {scales.a.ticks.map((tick) => (
              <Text
                key={`l${tick}`}
                style={[styles.leftTick, { color: theme.muted, top: yCount(tick) - 7 }]}
              >
                {formatCount(tick)}
              </Text>
            ))}

            {/* Eixo da direita: a grandeza contínua. */}
            {scales.b.ticks.map((tick, index) => (
              <Text
                key={`r${tick}`}
                numberOfLines={1}
                style={[
                  styles.rightTick,
                  { color: theme.muted, top: yCount(scales.a.ticks[index]) - 7 },
                ]}
              >
                {formatAmount(tick)}
              </Text>
            ))}

            {/* O nome de cada eixo. É o que o legado não dizia: os números
                apareciam dos dois lados e cabia ao leitor adivinhar de quem
                eram. Numa escala dupla isso não é decoração. */}
            <Text style={[styles.axisName, styles.axisNameLeft, { color: theme.muted }]}>
              {countAxisLabel}
            </Text>
            <Text style={[styles.axisName, styles.axisNameRight, { color: theme.muted }]}>
              {amountAxisLabel}
            </Text>

            {countPoints.map((point, index) =>
              index % labelStep === 0 ? (
                <Text
                  key={point.key}
                  numberOfLines={1}
                  style={[
                    styles.xLabel,
                    {
                      color: active === index ? theme.textPrimary : theme.muted,
                      // Centrada na faixa e presa dentro do desenho: no
                      // primeiro e no último ponto ela sairia pela borda.
                      left: Math.max(
                        0,
                        Math.min(
                          LEFT_AXIS + band * index + band / 2 - labelWidth / 2,
                          width - labelWidth
                        )
                      ),
                      width: labelWidth,
                    },
                  ]}
                >
                  {point.label}
                </Text>
              ) : null
            )}

            {/* Faixas de acerto: a área sensível é a faixa inteira, muito maior
                que a marca — e é o que dá foco de teclado a cada ponto. */}
            <View
              style={[
                styles.hitRow,
                { left: LEFT_AXIS, right: RIGHT_AXIS, height: height - AXIS_BAND },
              ]}
            >
              {countPoints.map((point, index) => (
                <Pressable
                  key={point.key}
                  accessibilityRole={onSelect ? 'button' : 'text'}
                  accessibilityLabel={`${point.label}: ${formatCount(point.value)} ${countAxisLabel}, ${formatAmount(
                    amountPoints[index]?.value ?? 0
                  )}${onSelect ? '. Toque para filtrar o painel.' : ''}`}
                  accessibilityState={
                    onSelect ? { selected: selectedKey === point.key } : undefined
                  }
                  onPress={onSelect ? () => onSelect(point.key) : undefined}
                  onHoverIn={() => setActive(index)}
                  onHoverOut={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  style={styles.hit}
                />
              ))}
            </View>
          </>
        )}
      </View>

      {/* Um tooltip, as duas séries: o cursor nunca precisa cair em cima de uma
          linha para dar o número dela. */}
      {active !== null && (
        <ChartTooltip
          title={countPoints[active].label}
          anchor={(active + 0.5) / countPoints.length}
          rows={[
            {
              key: 'count',
              color: countColor,
              label: countLabel,
              value: formatCount(countPoints[active].value),
            },
            {
              key: 'amount',
              color: amountColor,
              label: amountLabel,
              value: formatAmount(amountPoints[active]?.value ?? 0),
            },
          ]}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // A legenda espelha a marca: retângulo para colunas, traço para a linha.
  legendRect: { width: 10, height: 10, borderRadius: 3 },
  legendLine: { width: 14, height: 2, borderRadius: 1 },
  legendLabel: { fontSize: 12 },
  leftTick: {
    position: 'absolute',
    pointerEvents: 'none',
    left: 0,
    width: LEFT_AXIS - 8,
    fontSize: 10,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  rightTick: {
    position: 'absolute',
    pointerEvents: 'none',
    right: 0,
    width: RIGHT_AXIS - 8,
    fontSize: 10,
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },
  axisName: {
    position: 'absolute',
    top: 0,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  axisNameLeft: { left: 0 },
  axisNameRight: { right: 0 },
  xLabel: {
    position: 'absolute',
    pointerEvents: 'none',
    bottom: 0,
    fontSize: 10,
    textAlign: 'center',
  },
  hitRow: { position: 'absolute', top: 0, flexDirection: 'row' },
  hit: { flex: 1, height: '100%' },
})
