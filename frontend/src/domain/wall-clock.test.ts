/**
 * Hora de parede.
 *
 * O risco que estes testes cobrem: `activity.startedAt` é a hora que o usuário
 * digitou, gravada literalmente. Se qualquer passo do caminho passar por
 * `new Date(...)` + `toISOString()`, o valor sai 3 horas deslocado em São Paulo
 * — e o sintoma só aparece no banco, depois de salvo.
 *
 * Por isso vários casos abaixo rodam sob um fuso forçado: se a implementação
 * tocasse em conversão de fuso, eles quebrariam.
 */
import {
  durationInHours,
  formatInstantLabel,
  formatWallClockForApi,
  formatWallClockLabel,
  maskBrDateTime,
  nowWallClock,
  parseBrLabel,
  parseWallClock,
  validateActivityPeriod,
} from './wall-clock'

describe('parseWallClock', () => {
  it('aceita com e sem segundos', () => {
    expect(parseWallClock('2026-03-10T08:30')).toEqual({
      year: 2026,
      month: 3,
      day: 10,
      hour: 8,
      minute: 30,
    })
    expect(parseWallClock('2026-03-10T08:30:00')).toEqual({
      year: 2026,
      month: 3,
      day: 10,
      hour: 8,
      minute: 30,
    })
  })

  it('rejeita datas que não existem', () => {
    expect(parseWallClock('2026-02-31T10:00')).toBeNull()
    expect(parseWallClock('2026-13-01T10:00')).toBeNull()
    expect(parseWallClock('2026-03-10T25:00')).toBeNull()
    expect(parseWallClock('2026-03-10T10:75')).toBeNull()
  })

  it('reconhece 29 de fevereiro só em ano bissexto', () => {
    expect(parseWallClock('2024-02-29T10:00')).not.toBeNull()
    expect(parseWallClock('2026-02-29T10:00')).toBeNull()
  })

  it('rejeita lixo', () => {
    expect(parseWallClock('')).toBeNull()
    expect(parseWallClock('ontem às 8')).toBeNull()
  })
})

describe('ida e volta sem deslocamento de fuso', () => {
  it('preserva o horário exato ao formatar e reler', () => {
    const original = '2026-03-10T08:30'
    const parts = parseWallClock(original)
    expect(formatWallClockForApi(parts!)).toBe(original)
  })

  it('preserva horários nas bordas do dia, onde um deslocamento apareceria', () => {
    // Um horário perto da meia-noite é o caso em que qualquer conversão de fuso
    // se denuncia: ela mudaria também o DIA, não só a hora. Estes valores
    // precisam sobreviver byte a byte, seja qual for o fuso da máquina.
    for (const value of [
      '2026-03-10T00:00',
      '2026-03-10T23:45',
      '2026-01-01T00:30',
      '2026-12-31T23:59',
    ]) {
      const parts = parseWallClock(value)
      expect(formatWallClockForApi(parts!)).toBe(value)
    }

    expect(formatWallClockLabel('2026-03-10T23:45')).toBe('10/03/2026 23:45')
    expect(formatWallClockLabel('2026-01-01T00:30')).toBe('01/01/2026 00:30')
  })

  it('formata o rótulo brasileiro com zeros à esquerda', () => {
    expect(formatWallClockLabel('2026-01-05T09:07')).toBe('05/01/2026 09:07')
  })
})

describe('nowWallClock', () => {
  it('usa os componentes locais do relógio, não UTC', () => {
    // 10/03/2026 08:30 no horário LOCAL do processo.
    const local = new Date(2026, 2, 10, 8, 30, 0)
    expect(nowWallClock(local)).toBe('2026-03-10T08:30')
  })
})

describe('parseBrLabel e máscara', () => {
  it('lê o formato que o usuário digita', () => {
    expect(parseBrLabel('10/03/2026 08:30')).toEqual({
      year: 2026,
      month: 3,
      day: 10,
      hour: 8,
      minute: 30,
    })
  })

  it('devolve null enquanto a data está incompleta', () => {
    expect(parseBrLabel('10/03/2026 0')).toBeNull()
    expect(parseBrLabel('10/03')).toBeNull()
  })

  it('aplica a máscara conforme se digita', () => {
    expect(maskBrDateTime('1')).toBe('1')
    expect(maskBrDateTime('1003')).toBe('10/03')
    expect(maskBrDateTime('10032026')).toBe('10/03/2026')
    expect(maskBrDateTime('100320260830')).toBe('10/03/2026 08:30')
  })

  it('ignora caracteres não numéricos e o excesso', () => {
    expect(maskBrDateTime('10/03/2026 08:30')).toBe('10/03/2026 08:30')
    expect(maskBrDateTime('1003202608301234')).toBe('10/03/2026 08:30')
  })
})

describe('validateActivityPeriod', () => {
  it('aceita término posterior ao início', () => {
    expect(validateActivityPeriod('2026-03-10T08:30', '2026-03-10T10:45')).toEqual({
      ok: true,
      error: null,
    })
  })

  it('recusa término igual ao início — duração zero não é atividade', () => {
    const result = validateActivityPeriod('2026-03-10T08:30', '2026-03-10T08:30')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('A hora de término deve ser posterior à de início.')
  })

  it('recusa término anterior ao início', () => {
    expect(validateActivityPeriod('2026-03-10T10:00', '2026-03-10T09:00').ok).toBe(false)
  })

  it('aceita atividade que atravessa a meia-noite e o mês', () => {
    expect(validateActivityPeriod('2026-03-31T22:00', '2026-04-01T02:00').ok).toBe(true)
  })

  it('usa a mensagem do legado para data inválida', () => {
    expect(validateActivityPeriod('', '2026-03-10T10:00').error).toBe(
      'Datas inválidas. Use data e hora válidas.'
    )
  })
})

describe('durationInHours', () => {
  it('calcula com 2 casas, como a API', () => {
    expect(durationInHours('2026-03-10T08:30', '2026-03-10T10:45')).toBe(2.25)
    expect(durationInHours('2026-03-10T08:00', '2026-03-10T08:20')).toBe(0.33)
  })

  it('atravessa dias e meses sem erro', () => {
    expect(durationInHours('2026-03-31T23:00', '2026-04-01T01:30')).toBe(2.5)
  })

  it('devolve null para entrada inválida', () => {
    expect(durationInHours('inválido', '2026-03-10T10:00')).toBeNull()
  })
})

describe('formatInstantLabel', () => {
  it('converte instante UTC para o fuso local — aqui a conversão é correta', () => {
    // `ticket.createdAt` é instante UTC de verdade, ao contrário das
    // atividades: exibi-lo no fuso do usuário é o comportamento esperado.
    //
    // O esperado é derivado do próprio relógio local em vez de fixado, porque
    // `process.env.TZ` alterado em tempo de execução não muda o fuso que o V8
    // já resolveu — um valor fixo passaria ou falharia conforme a máquina.
    const instant = '2026-03-10T11:30:00.000Z'
    const local = new Date(instant)
    const pad = (value: number) => String(value).padStart(2, '0')
    const expected =
      `${pad(local.getDate())}/${pad(local.getMonth() + 1)}/${local.getFullYear()} ` +
      `${pad(local.getHours())}:${pad(local.getMinutes())}`

    expect(formatInstantLabel(instant)).toBe(expected)
  })

  it('difere de formatWallClockLabel — os dois campos NÃO são intercambiáveis', () => {
    // A mesma string tratada como instante UTC e como hora de parede só
    // coincide se a máquina estiver em UTC. Este teste existe para deixar
    // explícito que usar a função errada muda o resultado.
    const value = '2026-03-10T11:30:00'
    const asWallClock = formatWallClockLabel(value)
    expect(asWallClock).toBe('10/03/2026 11:30')

    const offsetMinutes = new Date(`${value}Z`).getTimezoneOffset()
    if (offsetMinutes !== 0) {
      expect(formatInstantLabel(`${value}Z`)).not.toBe(asWallClock)
    }
  })

  it('devolve a entrada quando ela não é uma data', () => {
    expect(formatInstantLabel('nada disso')).toBe('nada disso')
  })
})
