// Geometria dos gráficos: caminhos SVG e escalas de eixo.
//
// Fica separado dos componentes porque é a parte testável sem renderizar nada —
// e porque um caminho errado aqui é um gráfico que MENTE, não um gráfico feio.

/**
 * Coluna com o topo arredondado e a base reta.
 *
 * Um `rect` com `rx` arredondaria os quatro cantos, e o canto de baixo
 * arredondado descola a barra da linha de base — a marca passa a começar
 * "depois" do zero. O raio também é limitado pela metade da altura: numa barra
 * de 3px um raio de 4 viraria uma pastilha, que lê como outra coisa.
 */
export function roundedTopBarPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 4
): string {
  if (height <= 0 || width <= 0) return ''
  const r = Math.max(0, Math.min(radius, width / 2, height))
  const right = x + width
  const bottom = y + height
  return [
    `M${x},${bottom}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${right - r},${y}`,
    `Q${right},${y} ${right},${y + r}`,
    `L${right},${bottom}`,
    'Z',
  ].join(' ')
}

export interface Point {
  x: number
  y: number
}

/**
 * Curva suave que NÃO ultrapassa os pontos (interpolação cúbica monotônica).
 *
 * A suavização ingênua (Catmull-Rom ou `tension` do Chart.js) faz a curva
 * passar abaixo de zero entre dois pontos baixos e acima do pico entre dois
 * altos. Num gráfico de horas isso desenha trabalho negativo e um pico que não
 * aconteceu. O método de Fritsch–Carlson corta a inclinação em cada nó para
 * impedir exatamente isso: a curva é suave e continua fiel ao dado.
 */
export function smoothLinePath(points: Point[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M${points[0].x},${points[0].y}`
  if (points.length === 2) {
    return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`
  }

  const n = points.length
  const dx: number[] = []
  const slopes: number[] = []

  for (let i = 0; i < n - 1; i += 1) {
    const h = points[i + 1].x - points[i].x
    dx.push(h)
    slopes.push(h === 0 ? 0 : (points[i + 1].y - points[i].y) / h)
  }

  // Tangente em cada nó: média ponderada das secantes vizinhas, e ZERO sempre
  // que as secantes trocam de sinal — é isso que trava o overshoot no extremo.
  const tangents: number[] = new Array(n).fill(0)
  tangents[0] = slopes[0]
  tangents[n - 1] = slopes[n - 2]
  for (let i = 1; i < n - 1; i += 1) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      tangents[i] = 0
    } else {
      const w1 = 2 * dx[i] + dx[i - 1]
      const w2 = dx[i] + 2 * dx[i - 1]
      tangents[i] = (w1 + w2) / (w1 / slopes[i - 1] + w2 / slopes[i])
    }
  }

  const parts = [`M${points[0].x},${points[0].y}`]
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3
    const c1x = points[i].x + h
    const c1y = points[i].y + tangents[i] * h
    const c2x = points[i + 1].x - h
    const c2y = points[i + 1].y - tangents[i + 1] * h
    parts.push(`C${c1x},${c1y} ${c2x},${c2y} ${points[i + 1].x},${points[i + 1].y}`)
  }
  return parts.join(' ')
}

/** Fecha uma linha contra a base para virar área. Sem base, sem preenchimento. */
export function closeAreaPath(linePath: string, points: Point[], baselineY: number): string {
  if (linePath === '' || points.length === 0) return ''
  const first = points[0]
  const last = points[points.length - 1]
  return `${linePath} L${last.x},${baselineY} L${first.x},${baselineY} Z`
}

/**
 * Topo do eixo em número redondo, com os valores dos traços.
 *
 * Eixo terminando em "37" faz o leitor calcular; terminando em 40 ele lê. O
 * passo sai de 1/2/5×10ⁿ, que é o conjunto que produz múltiplos mentalmente
 * divisíveis. Série toda zerada devolve um eixo 0–1 em vez de 0–0, senão a
 * altura de cada barra viraria divisão por zero.
 */
export function niceScale(maxValue: number, targetTicks = 4): { max: number; ticks: number[] } {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return { max: 1, ticks: [0, 1] }

  const rawStep = maxValue / targetTicks
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalized = rawStep / magnitude
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  const step = niceNormalized * magnitude

  const max = Math.ceil(maxValue / step) * step
  const ticks: number[] = []
  // Acumular por multiplicação evita o arrasto de ponto flutuante que faz um
  // traço sair como 0,30000000000000004 no rótulo.
  for (let i = 0; i * step <= max + step / 1000; i += 1) ticks.push(i * step)
  return { max, ticks }
}

/**
 * Índice do ponto mais próximo de uma posição horizontal.
 *
 * O leitor mira numa data, não numa linha de 2px: o cursor pega a coluna mais
 * próxima em vez de exigir acerto em cima da marca.
 */
export function nearestIndex(x: number, count: number, width: number): number {
  if (count <= 0 || width <= 0) return -1
  const band = width / count
  return Math.max(0, Math.min(count - 1, Math.floor(x / band)))
}

/** Segmentos de um anel, em graus acumulados a partir das 12 horas. */
export interface ArcSegment<T> {
  item: T
  value: number
  /** Fração do total (0–1), já é o comprimento do traço no anel. */
  fraction: number
  /** Fração acumulada ANTES deste segmento — o deslocamento no anel. */
  offset: number
}

export function arcSegments<T>(items: T[], value: (item: T) => number): ArcSegment<T>[] {
  const total = items.reduce((sum, item) => sum + Math.max(value(item), 0), 0)
  if (total <= 0) return []

  let cursor = 0
  const segments: ArcSegment<T>[] = []
  for (const item of items) {
    const raw = Math.max(value(item), 0)
    if (raw === 0) continue
    segments.push({ item, value: raw, fraction: raw / total, offset: cursor })
    cursor += raw / total
  }
  return segments
}
