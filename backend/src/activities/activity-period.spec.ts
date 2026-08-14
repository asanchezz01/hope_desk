import { parseWallClockInput } from '../common/time/legacy-clock';
import {
  activityDurationHours,
  findActivityConflict,
  intervalsOverlap,
  PERIOD_DURATION_MESSAGE,
  PERIOD_ORDER_MESSAGE,
  validateActivityPeriod,
} from './activity-period';

const at = (iso: string) => parseWallClockInput(iso);

describe('validateActivityPeriod', () => {
  it('aceita intervalo válido', () => {
    expect(
      validateActivityPeriod(at('2026-03-10T08:00'), at('2026-03-10T12:00')),
    ).toBeNull();
  });

  it('rejeita fim igual ao início', () => {
    expect(validateActivityPeriod(at('2026-03-10T08:00'), at('2026-03-10T08:00'))).toBe(
      PERIOD_ORDER_MESSAGE,
    );
  });

  it('rejeita fim anterior ao início', () => {
    expect(validateActivityPeriod(at('2026-03-10T12:00'), at('2026-03-10T08:00'))).toBe(
      PERIOD_ORDER_MESSAGE,
    );
  });

  it('aceita duração de EXATAMENTE 12 horas', () => {
    expect(
      validateActivityPeriod(at('2026-03-10T08:00'), at('2026-03-10T20:00')),
    ).toBeNull();
  });

  it('rejeita duração acima de 12 horas', () => {
    expect(validateActivityPeriod(at('2026-03-10T08:00'), at('2026-03-10T20:01'))).toBe(
      PERIOD_DURATION_MESSAGE,
    );
  });

  it('rejeita duração muito acima de 12 horas', () => {
    expect(validateActivityPeriod(at('2026-03-10T08:00'), at('2026-03-12T08:00'))).toBe(
      PERIOD_DURATION_MESSAGE,
    );
  });

  it('aceita atividade de um minuto', () => {
    expect(
      validateActivityPeriod(at('2026-03-10T08:00'), at('2026-03-10T08:01')),
    ).toBeNull();
  });

  it('aceita atividade que atravessa a virada do dia', () => {
    expect(
      validateActivityPeriod(at('2026-03-10T22:00'), at('2026-03-11T02:00')),
    ).toBeNull();
  });

  it('aceita atividade que atravessa a virada do mês', () => {
    expect(
      validateActivityPeriod(at('2026-01-31T20:00'), at('2026-02-01T04:00')),
    ).toBeNull();
  });

  it('aceita atividade que atravessa a virada do ano', () => {
    expect(
      validateActivityPeriod(at('2025-12-31T21:00'), at('2026-01-01T05:00')),
    ).toBeNull();
  });

  it('verifica a ordem ANTES da duração', () => {
    // Invertido e com mais de 12h: a mensagem é a de ordem.
    expect(validateActivityPeriod(at('2026-03-12T08:00'), at('2026-03-10T08:00'))).toBe(
      PERIOD_ORDER_MESSAGE,
    );
  });
});

describe('intervalsOverlap', () => {
  const base = { startedAt: at('2026-03-10T10:00'), endedAt: at('2026-03-10T12:00') };

  it('intervalos idênticos se sobrepõem', () => {
    expect(intervalsOverlap(base, base)).toBe(true);
  });

  it('sobreposição total (um contém o outro)', () => {
    const outer = {
      startedAt: at('2026-03-10T08:00'),
      endedAt: at('2026-03-10T18:00'),
    };
    expect(intervalsOverlap(base, outer)).toBe(true);
    expect(intervalsOverlap(outer, base)).toBe(true);
  });

  it('sobreposição parcial pelo início', () => {
    const other = {
      startedAt: at('2026-03-10T09:00'),
      endedAt: at('2026-03-10T11:00'),
    };
    expect(intervalsOverlap(base, other)).toBe(true);
  });

  it('sobreposição parcial pelo fim', () => {
    const other = {
      startedAt: at('2026-03-10T11:00'),
      endedAt: at('2026-03-10T13:00'),
    };
    expect(intervalsOverlap(base, other)).toBe(true);
  });

  it('intervalos ADJACENTES não conflitam (fim = início)', () => {
    const before = {
      startedAt: at('2026-03-10T08:00'),
      endedAt: at('2026-03-10T10:00'),
    };
    const after = {
      startedAt: at('2026-03-10T12:00'),
      endedAt: at('2026-03-10T14:00'),
    };
    expect(intervalsOverlap(base, before)).toBe(false);
    expect(intervalsOverlap(base, after)).toBe(false);
  });

  it('intervalos separados não conflitam', () => {
    const other = {
      startedAt: at('2026-03-11T10:00'),
      endedAt: at('2026-03-11T12:00'),
    };
    expect(intervalsOverlap(base, other)).toBe(false);
  });

  it('sobreposição de um minuto conta como conflito', () => {
    const other = {
      startedAt: at('2026-03-10T11:59'),
      endedAt: at('2026-03-10T13:00'),
    };
    expect(intervalsOverlap(base, other)).toBe(true);
  });

  it('detecta sobreposição atravessando a virada do dia', () => {
    const overnight = {
      startedAt: at('2026-03-10T22:00'),
      endedAt: at('2026-03-11T02:00'),
    };
    const morning = {
      startedAt: at('2026-03-11T01:00'),
      endedAt: at('2026-03-11T03:00'),
    };
    expect(intervalsOverlap(overnight, morning)).toBe(true);
  });

  it('detecta sobreposição atravessando a virada do mês', () => {
    const crossing = {
      startedAt: at('2026-01-31T20:00'),
      endedAt: at('2026-02-01T04:00'),
    };
    const february = {
      startedAt: at('2026-02-01T02:00'),
      endedAt: at('2026-02-01T06:00'),
    };
    expect(intervalsOverlap(crossing, february)).toBe(true);
  });
});

describe('findActivityConflict', () => {
  const candidates = [
    { id: 1, startedAt: at('2026-03-10T14:00'), endedAt: at('2026-03-10T16:00') },
    { id: 2, startedAt: at('2026-03-10T08:00'), endedAt: at('2026-03-10T12:00') },
    { id: 3, startedAt: at('2026-03-11T08:00'), endedAt: at('2026-03-11T10:00') },
  ];

  it('devolve null quando não há sobreposição', () => {
    expect(
      findActivityConflict(candidates, at('2026-03-12T08:00'), at('2026-03-12T10:00')),
    ).toBeNull();
  });

  it('encontra a atividade sobreposta', () => {
    const conflict = findActivityConflict(
      candidates,
      at('2026-03-10T09:00'),
      at('2026-03-10T10:00'),
    );
    expect(conflict?.id).toBe(2);
  });

  it('devolve a PRIMEIRA em ordem de início ascendente', () => {
    // Um intervalo que cobre as duas atividades do dia 10.
    const conflict = findActivityConflict(
      candidates,
      at('2026-03-10T07:00'),
      at('2026-03-10T18:00'),
    );
    // A de id 2 começa às 08:00, antes da de id 1 (14:00).
    expect(conflict?.id).toBe(2);
  });

  it('exclui a própria atividade durante a edição', () => {
    // Mesmo intervalo da atividade 2: sem exclusão conflita, com exclusão não.
    expect(
      findActivityConflict(candidates, at('2026-03-10T08:00'), at('2026-03-10T12:00'))
        ?.id,
    ).toBe(2);

    expect(
      findActivityConflict(
        candidates,
        at('2026-03-10T08:00'),
        at('2026-03-10T12:00'),
        2,
      ),
    ).toBeNull();
  });

  it('a exclusão não esconde conflito com OUTRA atividade', () => {
    const conflict = findActivityConflict(
      candidates,
      at('2026-03-10T07:00'),
      at('2026-03-10T15:00'),
      2,
    );
    expect(conflict?.id).toBe(1);
  });

  it('não conflita com atividade adjacente', () => {
    expect(
      findActivityConflict(candidates, at('2026-03-10T12:00'), at('2026-03-10T14:00')),
    ).toBeNull();
  });

  it('devolve null para lista vazia', () => {
    expect(
      findActivityConflict([], at('2026-03-10T08:00'), at('2026-03-10T10:00')),
    ).toBeNull();
  });
});

describe('activityDurationHours', () => {
  it.each([
    ['2026-03-10T08:00', '2026-03-10T12:00', 4],
    ['2026-03-10T08:00', '2026-03-10T08:30', 0.5],
    ['2026-03-10T08:00', '2026-03-10T09:20', 1.33],
    ['2026-03-10T22:00', '2026-03-11T02:00', 4],
    ['2026-01-31T20:00', '2026-02-01T04:00', 8],
  ])('de %s a %s são %s horas', (start, end, expected) => {
    expect(activityDurationHours(at(start), at(end))).toBe(expected);
  });

  it('nunca é negativa, como o legado', () => {
    expect(activityDurationHours(at('2026-03-10T12:00'), at('2026-03-10T08:00'))).toBe(
      0,
    );
  });
});
