import type { AnalyticsActivityRow, AnalyticsTicketRow } from '../api/analytics'

import {
  activeFilters,
  crossKpis,
  fixedCategories,
  filterActivities,
  filterTickets,
  NO_FILTERS,
  toggleFilter,
} from './analytics-filters'

function ticket(overrides: Partial<AnalyticsTicketRow>): AnalyticsTicketRow {
  return {
    id: 1,
    title: 'Chamado',
    status: 'aberto',
    statusLabel: 'Em aberto',
    module: 'Financeiro',
    client: 'Acme',
    technician: 'Ana',
    technicians: ['Ana'],
    bucket: '01',
    createdAt: '2026-03-01T12:00:00Z',
    createdLabel: '01/03/2026',
    hours: 0,
    responseHours: null,
    ageDays: null,
    ...overrides,
  }
}

function activity(overrides: Partial<AnalyticsActivityRow>): AnalyticsActivityRow {
  return {
    ticketId: 1,
    bucket: '01',
    technician: 'Ana',
    hours: 1,
    status: 'aberto',
    module: 'Financeiro',
    client: 'Acme',
    ...overrides,
  }
}

describe('toggleFilter', () => {
  it('liga a dimensão no primeiro clique', () => {
    expect(toggleFilter(NO_FILTERS, 'module', 'Fiscal').module).toBe('Fiscal')
  })

  it('desliga ao clicar de novo no mesmo valor — o clique é interruptor', () => {
    const on = toggleFilter(NO_FILTERS, 'module', 'Fiscal')
    expect(toggleFilter(on, 'module', 'Fiscal').module).toBeNull()
  })

  it('troca de valor sem desligar quando o clique é em outra categoria', () => {
    const on = toggleFilter(NO_FILTERS, 'module', 'Fiscal')
    expect(toggleFilter(on, 'module', 'Estoque').module).toBe('Estoque')
  })

  it('não mexe nas outras dimensões', () => {
    const both = toggleFilter(toggleFilter(NO_FILTERS, 'module', 'Fiscal'), 'status', 'aberto')
    expect(both).toMatchObject({ module: 'Fiscal', status: 'aberto', tech: null })
  })
})

describe('activeFilters', () => {
  it('devolve os filtros na ordem fixa das dimensões, não na do clique', () => {
    const filters = toggleFilter(toggleFilter(NO_FILTERS, 'client', 'Acme'), 'status', 'aberto')
    expect(activeFilters(filters).map((entry) => entry.dimension)).toEqual(['status', 'client'])
  })
})

describe('filterTickets', () => {
  const tickets = [
    ticket({ id: 1, module: 'Fiscal', status: 'aberto' }),
    ticket({ id: 2, module: 'Estoque', status: 'aberto' }),
    ticket({ id: 3, module: 'Fiscal', status: 'fechado' }),
  ]

  it('recorta por uma dimensão', () => {
    const filters = toggleFilter(NO_FILTERS, 'module', 'Fiscal')
    expect(filterTickets(tickets, filters).map((row) => row.id)).toEqual([1, 3])
  })

  it('combina dimensões com E, nunca com OU', () => {
    const filters = toggleFilter(toggleFilter(NO_FILTERS, 'module', 'Fiscal'), 'status', 'aberto')
    expect(filterTickets(tickets, filters).map((row) => row.id)).toEqual([1])
  })

  it('ignora a própria dimensão quando `skip` é informado', () => {
    // É o que mantém as outras barras visíveis no gráfico de módulos: sem isso
    // sobraria uma barra só e não haveria como trocar de módulo.
    const filters = toggleFilter(NO_FILTERS, 'module', 'Fiscal')
    expect(filterTickets(tickets, filters, 'module')).toHaveLength(3)
  })

  it('um chamado com vários técnicos entra no recorte de qualquer um deles', () => {
    const shared = [ticket({ id: 9, technicians: ['Ana', 'Bruno'] })]
    expect(filterTickets(shared, toggleFilter(NO_FILTERS, 'tech', 'Bruno'))).toHaveLength(1)
  })
})

describe('filterActivities', () => {
  it('casa o técnico pelo campo singular da atividade', () => {
    const activities = [activity({ technician: 'Ana' }), activity({ technician: 'Bruno' })]
    const filtered = filterActivities(activities, toggleFilter(NO_FILTERS, 'tech', 'Ana'))
    expect(filtered).toHaveLength(1)
  })
})

describe('fixedCategories', () => {
  it('ordena por grandeza sobre o conjunto completo', () => {
    const tickets = [
      ticket({ module: 'Fiscal' }),
      ticket({ module: 'Estoque' }),
      ticket({ module: 'Fiscal' }),
    ]
    expect(
      fixedCategories(
        tickets,
        (row) => row.module,
        () => 1
      )
    ).toEqual(['Fiscal', 'Estoque'])
  })

  it('a ordem NÃO muda quando o recorte esvazia uma categoria', () => {
    // O eixo reordenar ao filtrar faz o leitor perder a referência que acabou
    // de usar. As categorias saem sempre do conjunto completo.
    const tickets = [
      ticket({ module: 'Fiscal' }),
      ticket({ module: 'Estoque' }),
      ticket({ module: 'Fiscal' }),
    ]
    const all = fixedCategories(
      tickets,
      (row) => row.module,
      () => 1
    )
    const filtered = filterTickets(tickets, toggleFilter(NO_FILTERS, 'module', 'Estoque'))
    expect(all).toEqual(['Fiscal', 'Estoque'])
    expect(filtered).toHaveLength(1)
  })

  it('corta a cauda no limite pedido', () => {
    const tickets = ['a', 'b', 'c', 'd'].flatMap((module, index) =>
      Array.from({ length: 4 - index }, () => ticket({ module }))
    )
    expect(
      fixedCategories(
        tickets,
        (row) => row.module,
        () => 1,
        2
      )
    ).toEqual(['a', 'b'])
  })
})

describe('crossKpis', () => {
  it('conta resolvido E fechado como concluídos', () => {
    const kpis = crossKpis(
      [
        ticket({ id: 1, status: 'resolvido' }),
        ticket({ id: 2, status: 'fechado' }),
        ticket({ id: 3, status: 'aberto' }),
      ],
      []
    )
    expect(kpis).toMatchObject({ totalTickets: 3, concludedTickets: 2, pendingTickets: 1 })
  })

  it('soma as horas das atividades, não as do chamado', () => {
    const kpis = crossKpis(
      [ticket({ id: 1, hours: 99 })],
      [activity({ hours: 2 }), activity({ hours: 3 })]
    )
    expect(kpis.totalHours).toBe(5)
    expect(kpis.hoursPerTicket).toBe(5)
  })

  it('exclui os nulos da idade média em vez de contá-los como zero', () => {
    // `ageDays` é nulo em chamado concluído. Tratar nulo como zero puxaria a
    // média para baixo a cada chamado fechado — o oposto do que ela diz.
    const kpis = crossKpis(
      [
        ticket({ id: 1, ageDays: 10 }),
        ticket({ id: 2, ageDays: null }),
        ticket({ id: 3, ageDays: 20 }),
      ],
      []
    )
    expect(kpis.averageOpenAgeDays).toBe(15)
  })

  it('devolve nulo — e não zero — quando não há nada para a média', () => {
    const kpis = crossKpis([], [])
    expect(kpis.hoursPerTicket).toBeNull()
    expect(kpis.averageOpenAgeDays).toBeNull()
    expect(kpis.averageFirstResponseHours).toBeNull()
  })
})
