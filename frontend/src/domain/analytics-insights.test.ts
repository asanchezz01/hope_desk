import type { AnalyticsResponse } from '../api/analytics'

import { buildInsights } from './analytics-insights'

function response(overrides: Partial<AnalyticsResponse> = {}): AnalyticsResponse {
  return {
    periodLabel: 'Março de 2026',
    bucketMode: 'day',
    buckets: [{ key: '01', label: '01/03' }],
    selectedYear: 2026,
    selectedMonth: 3,
    availableYears: [2026],
    kpis: {
      totalTickets: 0,
      concludedTickets: 0,
      openTickets: 0,
      totalHours: 0,
      averageHoursPerTicket: 0,
      averageFirstResponseHours: null,
      ticketsWithActivity: 0,
    },
    backlog: { total: 0, oldestDays: 0, oldestTicketId: null },
    byStatus: [],
    byModule: [],
    byTechnician: [],
    byClient: [],
    trend: [],
    tickets: [],
    activities: [],
    hoursByBucket: {},
    ticketsByBucket: {},
    accumulatedHours: 0,
    monthlyHoursAllowance: 0,
    paidHoursInPeriod: 0,
    cycleStartLabel: '01/03',
    cycleEndLabel: '31/03',
    statusMeta: {},
    ...overrides,
  }
}

function ticket(module: string, bucket = '01') {
  return {
    id: 1,
    title: 't',
    status: 'aberto',
    statusLabel: 'Em aberto',
    module,
    client: 'Acme',
    technician: 'Ana',
    technicians: ['Ana'],
    bucket,
    createdAt: '2026-03-01T00:00:00Z',
    createdLabel: '01/03/2026',
    hours: 0,
    responseHours: null,
    ageDays: null,
  }
}

const textOf = (parts: { text: string }[]) => parts.map((part) => part.text).join('')

describe('buildInsights', () => {
  it('fica calado sem dado algum — frase vazia não é notícia', () => {
    expect(buildInsights(response())).toEqual([])
  })

  it('não fala de concentração abaixo do piso', () => {
    // Distribuição normal entre módulos se repete todo mês; dizer isso toda vez
    // treina a pessoa a não ler a faixa.
    const tickets = ['a', 'b', 'c', 'd', 'e'].map((module) => ticket(module))
    const insights = buildInsights(response({ tickets }))
    expect(insights.find((insight) => insight.id === 'module-concentration')).toBeUndefined()
  })

  it('aponta o módulo que concentra os chamados', () => {
    const tickets = [ticket('Fiscal'), ticket('Fiscal'), ticket('Fiscal'), ticket('Estoque')]
    const insight = buildInsights(response({ tickets })).find(
      (item) => item.id === 'module-concentration'
    )
    expect(textOf(insight!.parts)).toBe('O módulo Fiscal concentra 75% dos chamados do período.')
  })

  it('mantém nome de cliente e módulo como TEXTO, em segmentos', () => {
    // O legado concatenava innerHTML com o nome vindo do banco; um módulo
    // chamado `<b>X` desenhava marcação. Aqui é sempre texto.
    const hostile = 'Silva & Cia <ME>'
    const tickets = [ticket(hostile), ticket(hostile), ticket(hostile)]
    const insight = buildInsights(response({ tickets })).find(
      (item) => item.id === 'module-concentration'
    )
    expect(insight!.parts.some((part) => part.text === hostile)).toBe(true)
  })

  it('avisa do backlog velho, mesmo num período tranquilo', () => {
    // O backlog é geral, não do recorte: um mês calmo não apaga um chamado
    // parado desde março, e é justamente esse que precisa aparecer.
    const insights = buildInsights(
      response({ backlog: { total: 4, oldestDays: 92, oldestTicketId: 17 } })
    )
    const stale = insights.find((insight) => insight.id === 'stale-backlog')
    expect(stale?.tone).toBe('attention')
    expect(textOf(stale!.parts)).toContain('92 dias')
    expect(textOf(stale!.parts)).toContain('#17')
  })

  it('cala sobre backlog novo', () => {
    const insights = buildInsights(
      response({ backlog: { total: 2, oldestDays: 3, oldestTicketId: 5 } })
    )
    expect(insights.find((insight) => insight.id === 'stale-backlog')).toBeUndefined()
  })

  it('avisa quando o banco de horas passa a franquia', () => {
    const insights = buildInsights(response({ accumulatedHours: 51.5, monthlyHoursAllowance: 40 }))
    const exceeded = insights.find((insight) => insight.id === 'allowance-exceeded')
    expect(exceeded?.tone).toBe('attention')
    expect(textOf(exceeded!.parts)).toContain('51,50 h')
  })

  it('não avisa de franquia quando não há franquia contratada', () => {
    const insights = buildInsights(response({ accumulatedHours: 10, monthlyHoursAllowance: 0 }))
    expect(insights.find((insight) => insight.id === 'allowance-exceeded')).toBeUndefined()
  })
})
