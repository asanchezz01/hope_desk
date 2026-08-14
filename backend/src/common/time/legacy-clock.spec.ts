import {
  addMonths,
  daysInMonth,
  durationHours,
  formatWallClockIso,
  formatWallClockPtBr,
  instantToWallClockParts,
  monthPeriodBounds,
  parseWallClockInput,
  startOfNextMonth,
  storageToWallClock,
  wallClockToStorage,
} from './legacy-clock';

describe('legacy-clock', () => {
  describe('parseWallClockInput', () => {
    it('trata entrada sem fuso como hora de parede', () => {
      const stored = parseWallClockInput('2026-03-10T08:30');
      // Gravado como "UTC fictício": os getters UTC devolvem a parede.
      expect(stored.toISOString()).toBe('2026-03-10T08:30:00.000Z');
      expect(storageToWallClock(stored)).toMatchObject({
        year: 2026,
        month: 3,
        day: 10,
        hour: 8,
        minute: 30,
      });
    });

    it('aceita segundos opcionais', () => {
      expect(parseWallClockInput('2026-03-10T08:30:45').toISOString()).toBe(
        '2026-03-10T08:30:45.000Z',
      );
    });

    it('aceita espaço em vez de T, como o isoformat do Python', () => {
      expect(parseWallClockInput('2026-03-10 08:30').toISOString()).toBe(
        '2026-03-10T08:30:00.000Z',
      );
    });

    it('converte entrada com offset para a parede de São Paulo', () => {
      // 11:30Z = 08:30 em São Paulo (UTC-3).
      expect(parseWallClockInput('2026-03-10T11:30:00Z').toISOString()).toBe(
        '2026-03-10T08:30:00.000Z',
      );
      expect(parseWallClockInput('2026-03-10T08:30:00-03:00').toISOString()).toBe(
        '2026-03-10T08:30:00.000Z',
      );
    });

    it('rejeita datas inexistentes em vez de normalizar em silêncio', () => {
      expect(() => parseWallClockInput('2026-02-30T10:00')).toThrow(/inexistente/);
      expect(() => parseWallClockInput('2026-13-01T10:00')).toThrow(/inexistente/);
    });

    it('rejeita entrada vazia ou inválida', () => {
      expect(() => parseWallClockInput('   ')).toThrow(/vazia/);
      expect(() => parseWallClockInput('não é data')).toThrow(/inválida/);
    });

    it('aceita 29 de fevereiro em ano bissexto', () => {
      expect(parseWallClockInput('2028-02-29T12:00').toISOString()).toBe(
        '2028-02-29T12:00:00.000Z',
      );
    });
  });

  describe('instantToWallClockParts', () => {
    it('aplica o offset de São Paulo (UTC-3, sem horário de verão desde 2019)', () => {
      expect(instantToWallClockParts(new Date('2026-07-29T14:00:00Z'))).toMatchObject({
        year: 2026,
        month: 7,
        day: 29,
        hour: 11,
      });
    });

    it('lida com a virada de dia', () => {
      // 01:30Z do dia 10 = 22:30 do dia 9 em São Paulo.
      expect(instantToWallClockParts(new Date('2026-03-10T01:30:00Z'))).toMatchObject({
        month: 3,
        day: 9,
        hour: 22,
        minute: 30,
      });
    });

    it('representa meia-noite como hora 0, não 24', () => {
      // 03:00Z = 00:00 em São Paulo.
      expect(instantToWallClockParts(new Date('2026-03-10T03:00:00Z')).hour).toBe(0);
    });
  });

  describe('monthPeriodBounds', () => {
    it('devolve [início do mês, início do mês seguinte)', () => {
      const [start, end] = monthPeriodBounds(2026, 3);
      expect(start.toISOString()).toBe('2026-03-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    });

    it('cruza a virada de ano em dezembro', () => {
      const [start, end] = monthPeriodBounds(2026, 12);
      expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });
  });

  describe('startOfNextMonth', () => {
    it('avança para o primeiro instante do mês seguinte', () => {
      const stored = wallClockToStorage({
        year: 2026,
        month: 1,
        day: 31,
        hour: 23,
        minute: 59,
        second: 59,
        millisecond: 0,
      });
      expect(startOfNextMonth(stored).toISOString()).toBe('2026-02-01T00:00:00.000Z');
    });
  });

  describe('daysInMonth', () => {
    it.each([
      [2026, 1, 31],
      [2026, 2, 28],
      [2028, 2, 29],
      [2026, 4, 30],
      [2026, 12, 31],
    ])('%i-%i tem %i dias', (year, month, expected) => {
      expect(daysInMonth(year, month)).toBe(expected);
    });
  });

  describe('addMonths', () => {
    it('soma seis meses preservando o dia', () => {
      const anchor = parseWallClockInput('2026-01-15T00:00');
      expect(addMonths(anchor, 6).toISOString()).toBe('2026-07-15T00:00:00.000Z');
    });

    it('subtrai seis meses cruzando o ano', () => {
      const anchor = parseWallClockInput('2026-03-15T00:00');
      expect(addMonths(anchor, -6).toISOString()).toBe('2025-09-15T00:00:00.000Z');
    });

    it('trunca para o último dia quando o dia não existe no mês de destino', () => {
      const anchor = parseWallClockInput('2026-01-31T00:00');
      expect(addMonths(anchor, 1).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    });

    it('trunca corretamente em ano bissexto', () => {
      const anchor = parseWallClockInput('2028-01-31T00:00');
      expect(addMonths(anchor, 1).toISOString()).toBe('2028-02-29T00:00:00.000Z');
    });

    it('lida com deslocamentos negativos maiores que um ano', () => {
      const anchor = parseWallClockInput('2026-03-10T00:00');
      expect(addMonths(anchor, -18).toISOString()).toBe('2024-09-10T00:00:00.000Z');
    });
  });

  describe('durationHours', () => {
    it('calcula a duração exata', () => {
      const start = parseWallClockInput('2026-03-10T08:00');
      const end = parseWallClockInput('2026-03-10T12:30');
      expect(durationHours(start, end)).toBeCloseTo(4.5, 10);
    });

    it('nunca devolve valor negativo, como o legado', () => {
      const start = parseWallClockInput('2026-03-10T12:00');
      const end = parseWallClockInput('2026-03-10T08:00');
      expect(durationHours(start, end)).toBe(0);
    });

    it('atravessa a virada do dia', () => {
      const start = parseWallClockInput('2026-03-10T22:00');
      const end = parseWallClockInput('2026-03-11T02:00');
      expect(durationHours(start, end)).toBeCloseTo(4, 10);
    });
  });

  describe('formatação', () => {
    it('serializa ISO local sem fuso', () => {
      expect(formatWallClockIso(parseWallClockInput('2026-03-10T08:05'))).toBe(
        '2026-03-10T08:05:00',
      );
    });

    it('serializa pt-BR como o legado (dd/mm/aaaa HH:MM)', () => {
      expect(formatWallClockPtBr(parseWallClockInput('2026-03-10T08:05'))).toBe(
        '10/03/2026 08:05',
      );
    });
  });
});
