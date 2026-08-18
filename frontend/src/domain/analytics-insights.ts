// A faixa de leitura do painel — as frases que o legado montava acima dos
// gráficos ("o módulo X concentra 40% dos chamados").
//
// Duas decisões deliberadas:
//
// 1. **Texto em segmentos, não em HTML.** O legado concatenava `innerHTML` com
//    nome de módulo e de técnico vindos do banco. Aqui cada frase sai como uma
//    lista de pedaços com `strong: true|false` e a tela os desenha como `Text`
//    — nome de cliente com `<` ou `&` é só texto, nunca marcação.
//
// 2. **Só o que é notícia.** Uma frase que se repete todo mês vira ruído e para
//    de ser lida. Cada regra tem um piso (concentração relevante, backlog velho,
//    volume que justifique falar em média) e fica calada abaixo dele.
import type { AnalyticsResponse } from '../api/analytics'

import { countBy, sumBy } from './analytics-filters'
import { formatDecimal, formatInteger } from './format'

/** `emphasis` distingue o número/nome do resto da frase, sem colorir texto. */
export interface InsightPart {
  text: string
  emphasis?: boolean
}

export type InsightTone = 'neutral' | 'attention'

export interface Insight {
  id: string
  icon: string
  tone: InsightTone
  parts: InsightPart[]
}

/** Concentração abaixo disto é distribuição normal, não notícia. */
const CONCENTRATION_FLOOR = 0.3
/** Backlog mais velho que isto merece ser dito em voz alta. */
const STALE_BACKLOG_DAYS = 30

export function buildInsights(data: AnalyticsResponse): Insight[] {
  const insights: Insight[] = []
  const tickets = data.tickets
  const totalHours = data.activities.reduce((total, activity) => total + activity.hours, 0)

  const top = <T>(totals: Map<string, T>): [string, T] | null => {
    const entries = [...totals.entries()]
    if (entries.length === 0) return null
    return entries.sort((a, b) => Number(b[1]) - Number(a[1]))[0]
  }

  if (tickets.length >= 3) {
    const topModule = top(countBy(tickets, (ticket) => ticket.module))
    if (topModule && topModule[1] / tickets.length >= CONCENTRATION_FLOOR) {
      insights.push({
        id: 'module-concentration',
        icon: '◆',
        tone: 'neutral',
        parts: [
          { text: 'O módulo ' },
          { text: topModule[0], emphasis: true },
          { text: ' concentra ' },
          { text: `${Math.round((topModule[1] / tickets.length) * 100)}%`, emphasis: true },
          { text: ' dos chamados do período.' },
        ],
      })
    }

    const topBucket = top(countBy(tickets, (ticket) => ticket.bucket))
    if (topBucket && topBucket[1] > 1) {
      const bucketLabel =
        data.buckets.find((bucket) => bucket.key === topBucket[0])?.label ?? topBucket[0]
      insights.push({
        id: 'peak-bucket',
        icon: '▲',
        tone: 'neutral',
        parts: [
          {
            text:
              data.bucketMode === 'day'
                ? 'O pico de aberturas foi em '
                : 'O mês de maior abertura foi ',
          },
          { text: bucketLabel, emphasis: true },
          { text: ', com ' },
          { text: formatInteger(topBucket[1]), emphasis: true },
          { text: topBucket[1] === 1 ? ' chamado.' : ' chamados.' },
        ],
      })
    }
  }

  if (totalHours > 0) {
    const topTech = top(
      sumBy(
        data.activities,
        (activity) => activity.technician,
        (activity) => activity.hours
      )
    )
    if (topTech && topTech[1] / totalHours >= CONCENTRATION_FLOOR) {
      insights.push({
        id: 'tech-load',
        icon: '●',
        tone: 'neutral',
        parts: [
          { text: topTech[0], emphasis: true },
          { text: ' registrou ' },
          { text: `${formatDecimal(topTech[1], 1)} h`, emphasis: true },
          { text: ', ' },
          { text: `${Math.round((topTech[1] / totalHours) * 100)}%`, emphasis: true },
          { text: ' das horas do período.' },
        ],
      })
    }
  }

  // O backlog é geral, não do período: um mês tranquilo não apaga um chamado
  // parado desde março, e é justamente esse que precisa aparecer.
  if (data.backlog.total > 0 && data.backlog.oldestDays >= STALE_BACKLOG_DAYS) {
    insights.push({
      id: 'stale-backlog',
      icon: '!',
      tone: 'attention',
      parts: [
        { text: 'O chamado em aberto mais antigo está parado há ' },
        { text: `${formatInteger(data.backlog.oldestDays)} dias`, emphasis: true },
        {
          text: data.backlog.oldestTicketId
            ? ` (#${data.backlog.oldestTicketId}), num backlog de ${formatInteger(data.backlog.total)}.`
            : `, num backlog de ${formatInteger(data.backlog.total)}.`,
        },
      ],
    })
  }

  // Franquia estourada é decisão de contrato, não curiosidade — por isso é
  // "attention" e vem do ciclo, não do recorte de tela.
  if (data.monthlyHoursAllowance > 0 && data.accumulatedHours > data.monthlyHoursAllowance) {
    insights.push({
      id: 'allowance-exceeded',
      icon: '!',
      tone: 'attention',
      parts: [
        { text: 'O banco de horas do ciclo está em ' },
        { text: `${formatDecimal(data.accumulatedHours, 2)} h`, emphasis: true },
        { text: ', acima da franquia de ' },
        { text: `${formatDecimal(data.monthlyHoursAllowance, 2)} h`, emphasis: true },
        { text: '.' },
      ],
    })
  }

  // Avisos primeiro. A ordem em que as regras são avaliadas é a ordem em que
  // foram escritas, não a ordem de importância: um backlog parado há 118 dias
  // não pode ficar atrás de "o módulo X concentra 45%".
  return [
    ...insights.filter((insight) => insight.tone === 'attention'),
    ...insights.filter((insight) => insight.tone !== 'attention'),
  ]
}
