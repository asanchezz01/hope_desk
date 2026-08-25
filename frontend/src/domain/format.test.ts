import {
  firstDayOfMonthIso,
  formatDecimal,
  formatHours,
  formatInteger,
  formatIsoDate,
  formatPercent,
  isoDaysAgo,
  maskBrDate,
  parseBrDateToIso,
  todayIsoDate,
} from './format'

describe('números em pt-BR', () => {
  it('usa ponto como separador de milhar', () => {
    expect(formatInteger(1234)).toBe('1.234')
    expect(formatInteger(1234567)).toBe('1.234.567')
    expect(formatInteger(999)).toBe('999')
    expect(formatInteger(0)).toBe('0')
  })

  it('usa vírgula decimal', () => {
    expect(formatDecimal(2.5)).toBe('2,50')
    expect(formatDecimal(1234.5)).toBe('1.234,50')
    expect(formatDecimal(0.333, 2)).toBe('0,33')
  })

  it('preserva o sinal negativo', () => {
    expect(formatInteger(-1234)).toBe('-1.234')
    expect(formatDecimal(-2.5)).toBe('-2,50')
  })

  it('acrescenta a unidade de horas', () => {
    expect(formatHours(2.25)).toBe('2,25 h')
  })

  it('não divide por zero no percentual', () => {
    expect(formatPercent(0, 0)).toBe('0%')
    expect(formatPercent(1, 4)).toBe('25%')
  })
})

describe('datas puras', () => {
  it('exibe AAAA-MM-DD como dd/mm/aaaa', () => {
    expect(formatIsoDate('2026-07-15')).toBe('15/07/2026')
  })

  it('não recua um dia — o valor nunca passa por Date', () => {
    // `new Date('2026-07-15').toISOString()` em São Paulo devolveria
    // 2026-07-14. É o mesmo cuidado que a API toma com `paid_at`.
    expect(formatIsoDate('2026-07-15')).toBe('15/07/2026')
    expect(parseBrDateToIso('15/07/2026')).toBe('2026-07-15')
    expect(parseBrDateToIso('01/01/2026')).toBe('2026-01-01')
    expect(parseBrDateToIso('31/12/2026')).toBe('2026-12-31')
  })

  it('aplica a máscara conforme se digita', () => {
    expect(maskBrDate('1')).toBe('1')
    expect(maskBrDate('1507')).toBe('15/07')
    expect(maskBrDate('15072026')).toBe('15/07/2026')
    expect(maskBrDate('15/07/2026')).toBe('15/07/2026')
    expect(maskBrDate('150720261234')).toBe('15/07/2026')
  })

  it('rejeita data incompleta ou inexistente', () => {
    expect(parseBrDateToIso('15/07')).toBeNull()
    expect(parseBrDateToIso('31/02/2026')).toBeNull()
    expect(parseBrDateToIso('15/13/2026')).toBeNull()
  })

  it('aceita 29 de fevereiro só em ano bissexto', () => {
    expect(parseBrDateToIso('29/02/2024')).toBe('2024-02-29')
    expect(parseBrDateToIso('29/02/2026')).toBeNull()
  })

  it('deriva hoje e o 1º do mês pelo relógio local', () => {
    const now = new Date(2026, 6, 15, 23, 30)
    expect(todayIsoDate(now)).toBe('2026-07-15')
    expect(firstDayOfMonthIso(now)).toBe('2026-07-01')
  })

  it('conta hoje como um dos dias da janela móvel', () => {
    // 30 dias terminando em 25/08 começa em 27/07, não em 26/07.
    const now = new Date(2026, 7, 25, 14, 37)
    expect(isoDaysAgo(30, now)).toBe('2026-07-27')
    expect(isoDaysAgo(1, now)).toBe('2026-08-25')
  })

  it('atravessa a virada do ano na janela móvel', () => {
    expect(isoDaysAgo(30, new Date(2026, 0, 10, 9))).toBe('2025-12-12')
    expect(isoDaysAgo(120, new Date(2026, 0, 10, 9))).toBe('2025-09-13')
  })
})
