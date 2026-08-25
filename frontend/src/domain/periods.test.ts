import {
  ALL_PERIODS,
  hasNoConcreteMonth,
  isPeriodValue,
  lastDaysOf,
  LAST_DAYS_OPTIONS,
  periodParams,
} from './periods'

describe('periods', () => {
  describe('periodParams', () => {
    it('manda ano e mês quando o período é um ano concreto', () => {
      expect(periodParams(2026, 8)).toEqual({ year: 2026, month: 8 })
    })

    it('omite o mês na visão anual do painel (sentinela 0)', () => {
      expect(periodParams(2026, 0)).toEqual({ year: 2026 })
    })

    it('manda só allPeriods em todo o histórico', () => {
      // Mandar o ano junto faria a API filtrar por período assim mesmo.
      expect(periodParams(ALL_PERIODS, 8)).toEqual({ allPeriods: true })
    })

    it('manda só lastDays na janela móvel, mesmo com mês na tela', () => {
      // O seletor de mês guarda o último valor escolhido; ele não pode vazar
      // para a requisição quando o recorte é "últimos 60 dias".
      expect(periodParams(-60, 8)).toEqual({ lastDays: 60 })
    })

    it('nunca combina dois recortes na mesma requisição', () => {
      for (const period of [2026, 0, -30, -60, -90, -120]) {
        const params = periodParams(period, 8)
        const recortes = [params.lastDays, params.allPeriods, params.year].filter(
          (value) => value !== undefined
        )
        expect(recortes).toHaveLength(1)
      }
    })
  })

  describe('lastDaysOf', () => {
    it('traduz o sentinela negativo para a quantidade de dias', () => {
      expect(lastDaysOf(-90)).toBe(90)
    })

    it('devolve undefined para ano concreto e para todo o período', () => {
      expect(lastDaysOf(2026)).toBeUndefined()
      expect(lastDaysOf(ALL_PERIODS)).toBeUndefined()
    })
  })

  describe('hasNoConcreteMonth', () => {
    it('só há mês a escolher dentro de um ano concreto', () => {
      expect(hasNoConcreteMonth(2026)).toBe(false)
      expect(hasNoConcreteMonth(ALL_PERIODS)).toBe(true)
      expect(hasNoConcreteMonth(-30)).toBe(true)
    })
  })

  describe('isPeriodValue', () => {
    it('aceita as opções que o seletor realmente oferece', () => {
      expect(isPeriodValue(ALL_PERIODS)).toBe(true)
      expect(isPeriodValue(2026)).toBe(true)
      for (const option of LAST_DAYS_OPTIONS) {
        expect(isPeriodValue(option.value)).toBe(true)
      }
    })

    it('recusa janela móvel que não existe', () => {
      // O caso real: `-45` gravado em disco por outra versão viraria
      // `lastDays=45`, e a API responde 400 na abertura da tela.
      expect(isPeriodValue(-45)).toBe(false)
      expect(isPeriodValue(-1)).toBe(false)
    })

    it('recusa lixo', () => {
      expect(isPeriodValue(1969)).toBe(false)
      expect(isPeriodValue(2026.5)).toBe(false)
      expect(isPeriodValue(Number.NaN)).toBe(false)
    })
  })
})
