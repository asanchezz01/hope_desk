import React, { useMemo, useState } from 'react'
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg'

import { useTheme } from '../../theme/ThemeContext'
import { DIMMED_OPACITY } from '../../theme/chart-palette'
import EmptyState from '../EmptyState'

import ChartTooltip from './ChartTooltip'
import { closeAreaPath, niceScale, roundedTopBarPath, smoothLinePath, type Point } from './geometry'
import { useReveal } from './useReveal'

export interface SeriesPoint {
  key: string
  label: string
  value: number
}

interface TimeSeriesChartProps {
  points: SeriesPoint[]
  /** Nome da grandeza — vira o rótulo do tooltip e a descrição acessível. */
  measure: string
  /** Colunas para contagem; área para uma grandeza contínua, como horas. */
  shape: 'columns' | 'area'
  color: string
  /** Formata valor para rótulo direto, tooltip e traços do eixo. */
  format: (value: number) => string
  height?: number
  /** Chave em foco; as outras marcas esmaecem. */
  selectedKey?: string | null
  onSelect?: (key: string) => void
  /** Índice sob o cursor, quando dois gráficos compartilham um eixo x. */
  hoveredIndex?: number | null
  onHoverIndex?: (index: number | null) => void
  /** Esconde os rótulos do eixo x — no par, só o de baixo os carrega. */
  hideAxisLabels?: boolean
}

const PLOT_PADDING_TOP = 16
const AXIS_BAND = 20
const Y_AXIS_WIDTH = 40
const MAX_BAR_WIDTH = 24
/**
 * Caixa do rótulo do extremo.
 *
 * Larga o bastante para "283,3 h" caber numa linha: amarrada à largura da
 * faixa, num mês de 31 dias ela tem ~40px e o texto quebra em duas linhas em
 * cima da própria curva. Rótulo que não cabe não é rótulo.
 */
const PEAK_LABEL_WIDTH = 64

/**
 * Uma grandeza ao longo do tempo. **Um eixo, sempre.**
 *
 * O painel antigo empilhava chamados e horas no mesmo gráfico com dois eixos y.
 * O alinhamento entre duas escalas é arbitrário, então o desenho inventava uma
 * correlação que o dado não tem — o pico de horas "acompanhando" o de chamados
 * era efeito de onde as duas escalas foram ancoradas, não do trabalho. Aqui
 * cada grandeza tem seu gráfico e sua escala; quando as duas interessam juntas,
 * `PairedTimeSeries` as empilha com o MESMO eixo x e um cursor compartilhado —
 * que é a leitura que os dois eixos tentavam dar, sem o erro de escala.
 */
export default function TimeSeriesChart({
  points,
  measure,
  shape,
  color,
  format,
  height = 168,
  selectedKey = null,
  onSelect,
  hoveredIndex,
  onHoverIndex,
  hideAxisLabels = false,
}: TimeSeriesChartProps) {
  const theme = useTheme()
  const [width, setWidth] = useState(0)
  const [localHover, setLocalHover] = useState<number | null>(null)

  const active = hoveredIndex !== undefined ? hoveredIndex : localHover
  const setActive = onHoverIndex ?? setLocalHover

  const progress = useReveal(`${shape}:${points.map((point) => point.value).join(',')}`)

  const scale = useMemo(
    () => niceScale(Math.max(...points.map((point) => point.value), 0)),
    [points]
  )

  if (points.length === 0) {
    return <EmptyState title="Nada a exibir" description="Sem histórico no período." />
  }

  const axisBand = hideAxisLabels ? 4 : AXIS_BAND
  // A altura declarada JÁ INCLUI a faixa dos rótulos do eixo. Dimensionar só o
  // desenho e deixar os rótulos vazarem é o que cria aquele scroll minúsculo
  // dentro do card.
  const plotHeight = height - axisBand - PLOT_PADDING_TOP
  const plotWidth = Math.max(width - Y_AXIS_WIDTH, 0)
  const band = plotWidth / points.length
  const baseline = PLOT_PADDING_TOP + plotHeight
  const yOf = (value: number) => PLOT_PADDING_TOP + plotHeight * (1 - value / scale.max)

  const maxIndex = points.reduce(
    (best, point, index) => (point.value > points[best].value ? index : best),
    0
  )

  const linePoints: Point[] = points.map((point, index) => ({
    x: band * index + band / 2,
    // A revelação interpola o VALOR, não a opacidade: a curva sobe do eixo como
    // o dado subiria, em vez de aparecer pronta e piscar.
    y: yOf(point.value * progress),
  }))

  const linePath = smoothLinePath(linePoints)
  const gradientId = `hd-area-${shape}-${measure.replace(/\W/g, '')}`
  const activePoint = active !== null && active >= 0 ? points[active] : null

  // Com muitas faixas os rótulos colidem; 1 em cada N é melhor que girar o
  // texto ou deixá-lo sobrepor o vizinho.
  const labelStep = Math.max(1, Math.ceil(points.length / (plotWidth > 520 ? 12 : 6)))

  return (
    <View style={styles.container}>
      <View
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        style={{ height }}
        accessibilityRole="text"
        accessibilityLabel={`${measure} por período: ${points
          .map((point) => `${point.label}, ${format(point.value)}`)
          .join('; ')}`}
      >
        {width > 0 && (
          <>
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  {/* Lavagem, nunca bloco saturado: a linha carrega o valor, a
                      área só amarra a leitura à base. */}
                  <Stop offset="0" stopColor={color} stopOpacity={0.28} />
                  <Stop offset="1" stopColor={color} stopOpacity={0.02} />
                </LinearGradient>
              </Defs>

              {/* Grade: fio sólido de 1px, um passo fora da superfície. Nunca
                  tracejada — tracejo lê como projeção ou limiar. */}
              {scale.ticks.map((tick) => (
                <Line
                  key={tick}
                  x1={Y_AXIS_WIDTH}
                  x2={width}
                  y1={yOf(tick)}
                  y2={yOf(tick)}
                  stroke={theme.border}
                  strokeWidth={1}
                />
              ))}

              {shape === 'columns' &&
                points.map((point, index) => {
                  const barWidth = Math.min(band * 0.62, MAX_BAR_WIDTH)
                  const top = yOf(point.value * progress)
                  const path = roundedTopBarPath(
                    Y_AXIS_WIDTH + band * index + (band - barWidth) / 2,
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
                      fill={color}
                      opacity={dimmed ? DIMMED_OPACITY : active === index ? 0.8 : 1}
                    />
                  )
                })}

              {shape === 'area' && (
                <>
                  <Path
                    d={closeAreaPath(linePath, linePoints, baseline)}
                    fill={`url(#${gradientId})`}
                    translateX={Y_AXIS_WIDTH}
                  />
                  <Path
                    d={linePath}
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    translateX={Y_AXIS_WIDTH}
                  />
                  {/* Ponta da série: anel de 2px na cor da superfície, para o
                      marcador não sumir onde cruza a própria linha. */}
                  <Circle
                    cx={Y_AXIS_WIDTH + linePoints[linePoints.length - 1].x}
                    cy={linePoints[linePoints.length - 1].y}
                    r={4}
                    fill={color}
                    stroke={theme.cardBg}
                    strokeWidth={2}
                  />
                </>
              )}

              {/* Cursor: o leitor mira numa data, não numa marca de 2px. */}
              {active !== null && active >= 0 && (
                <>
                  <Line
                    x1={Y_AXIS_WIDTH + band * active + band / 2}
                    x2={Y_AXIS_WIDTH + band * active + band / 2}
                    y1={PLOT_PADDING_TOP}
                    y2={baseline}
                    stroke={theme.muted}
                    strokeWidth={1}
                  />
                  {shape === 'area' && (
                    <Circle
                      cx={Y_AXIS_WIDTH + linePoints[active].x}
                      cy={linePoints[active].y}
                      r={4}
                      fill={color}
                      stroke={theme.cardBg}
                      strokeWidth={2}
                    />
                  )}
                </>
              )}
            </Svg>

            {/* Eixo y como texto do RN, e não `<Text>` do SVG: a fonte e o
                tamanho seguem o tema, sem uma segunda régua tipográfica. */}
            {scale.ticks.map((tick) => (
              <Text key={tick} style={[styles.yTick, { color: theme.muted, top: yOf(tick) - 7 }]}>
                {format(tick)}
              </Text>
            ))}

            {/* Rótulo direto no extremo — e só nele. Um número sobre cada
                coluna é ruído e não é lido; o eixo e o tooltip cobrem o resto.
                A caixa é centrada no ponto e presa dentro do desenho: no último
                ponto ela sairia pela direita e o texto ficaria cortado. */}
            {points[maxIndex].value > 0 && (
              <Text
                numberOfLines={1}
                style={[
                  styles.peakLabel,
                  {
                    color: theme.textSecondary,
                    left: Math.max(
                      0,
                      Math.min(
                        Y_AXIS_WIDTH + band * maxIndex + band / 2 - PEAK_LABEL_WIDTH / 2,
                        width - PEAK_LABEL_WIDTH
                      )
                    ),
                    width: PEAK_LABEL_WIDTH,
                    // Acima da marca: no gráfico de área o ponto final tem raio
                    // 4 mais o anel de 2, e 17px o mantém livre do texto.
                    top: Math.max(yOf(points[maxIndex].value * progress) - 17, 0),
                  },
                ]}
              >
                {format(points[maxIndex].value)}
              </Text>
            )}

            {!hideAxisLabels &&
              points.map((point, index) =>
                index % labelStep === 0 ? (
                  <Text
                    key={point.key}
                    numberOfLines={1}
                    style={[
                      styles.xLabel,
                      {
                        color: active === index ? theme.textPrimary : theme.muted,
                        left: Y_AXIS_WIDTH + band * index - band / 2,
                        width: band * 2,
                      },
                    ]}
                  >
                    {point.label}
                  </Text>
                ) : null
              )}

            {/* Faixas de acerto: a área sensível é a faixa inteira, muito maior
                que a marca — e é o que dá foco de teclado a cada ponto. */}
            <View style={[styles.hitRow, { left: Y_AXIS_WIDTH, height: height - axisBand }]}>
              {points.map((point, index) => (
                <Pressable
                  key={point.key}
                  accessibilityRole={onSelect ? 'button' : 'text'}
                  accessibilityLabel={`${point.label}: ${format(point.value)} ${measure}${
                    onSelect ? '. Toque para filtrar o painel.' : ''
                  }`}
                  accessibilityState={
                    onSelect ? { selected: selectedKey === point.key } : undefined
                  }
                  disabled={!onSelect && !onHoverIndex}
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

      {activePoint && (
        <ChartTooltip
          title={activePoint.label}
          anchor={active !== null ? (active + 0.5) / points.length : 0.5}
          rows={[{ key: measure, color, label: measure, value: format(activePoint.value) }]}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  yTick: {
    position: 'absolute',
    pointerEvents: 'none',
    left: 0,
    width: Y_AXIS_WIDTH - 8,
    fontSize: 10,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  xLabel: {
    position: 'absolute',
    pointerEvents: 'none',
    bottom: 0,
    fontSize: 10,
    textAlign: 'center',
  },
  peakLabel: {
    position: 'absolute',
    pointerEvents: 'none',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  hitRow: { position: 'absolute', top: 0, right: 0, flexDirection: 'row' },
  hit: { flex: 1, height: '100%' },
})
