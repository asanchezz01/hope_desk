import { canDeleteByMonth } from './deletion-window';
import { parseWallClockInput } from '../time/legacy-clock';

describe('canDeleteByMonth', () => {
  /** 15/07/2026 12:00 em São Paulo = 15:00 UTC. */
  const NOW = new Date('2026-07-15T15:00:00.000Z');

  describe('técnico comum', () => {
    it('exclui registro do mês corrente', () => {
      expect(
        canDeleteByMonth({
          recordDate: new Date('2026-07-10T12:00:00.000Z'),
          kind: 'utc-instant',
          isSuperuser: false,
          now: NOW,
        }),
      ).toBe(true);
    });

    it('não exclui registro do mês anterior', () => {
      expect(
        canDeleteByMonth({
          recordDate: new Date('2026-06-30T12:00:00.000Z'),
          kind: 'utc-instant',
          isSuperuser: false,
          now: NOW,
        }),
      ).toBe(false);
    });

    it('não exclui registro do mês seguinte', () => {
      expect(
        canDeleteByMonth({
          recordDate: new Date('2026-08-01T12:00:00.000Z'),
          kind: 'utc-instant',
          isSuperuser: false,
          now: NOW,
        }),
      ).toBe(false);
    });

    it('não exclui registro do mesmo mês em ano diferente', () => {
      expect(
        canDeleteByMonth({
          recordDate: new Date('2025-07-10T12:00:00.000Z'),
          kind: 'utc-instant',
          isSuperuser: false,
          now: NOW,
        }),
      ).toBe(false);
    });

    it('exclui no primeiro instante do mês corrente', () => {
      expect(
        canDeleteByMonth({
          recordDate: new Date('2026-07-01T00:00:00.000Z'),
          kind: 'utc-instant',
          isSuperuser: false,
          now: NOW,
        }),
      ).toBe(true);
    });

    it('exclui no último instante do mês corrente', () => {
      expect(
        canDeleteByMonth({
          recordDate: new Date('2026-07-31T23:59:59.000Z'),
          kind: 'utc-instant',
          isSuperuser: false,
          now: NOW,
        }),
      ).toBe(true);
    });
  });

  describe('superuser', () => {
    it.each([
      ['mês anterior', '2026-06-30T12:00:00.000Z'],
      ['ano anterior', '2020-01-01T12:00:00.000Z'],
      ['mês seguinte', '2026-08-01T12:00:00.000Z'],
    ])('exclui registro de %s', (_label, iso) => {
      expect(
        canDeleteByMonth({
          recordDate: new Date(iso),
          kind: 'utc-instant',
          isSuperuser: true,
          now: NOW,
        }),
      ).toBe(true);
    });
  });

  describe('inconsistência do legado preservada (§4.1)', () => {
    /**
     * `created_at` é UTC, mas `datetime.now()` é local. Nas 3 primeiras horas do
     * dia 1º, um chamado criado no fim do mês anterior (hora local) já está no
     * mês seguinte em UTC — e o legado o trata como do mês novo.
     */
    it('chamado criado em 31/07 21:00 local conta como agosto', () => {
      // 31/07 21:00 em São Paulo = 01/08 00:00 UTC.
      const createdAt = new Date('2026-08-01T00:00:00.000Z');
      // Agora: 01/08 01:00 local = 01/08 04:00 UTC.
      const now = new Date('2026-08-01T04:00:00.000Z');

      expect(
        canDeleteByMonth({
          recordDate: createdAt,
          kind: 'utc-instant',
          isSuperuser: false,
          now,
        }),
      ).toBe(true);
    });

    it('em 01/08 00:30 local, um chamado de 01/08 03:30 UTC ainda é de agosto', () => {
      // Agora: 01/08 00:30 local = 01/08 03:30 UTC. Mês local = agosto.
      const now = new Date('2026-08-01T03:30:00.000Z');
      // Chamado criado 01/08 03:00 UTC (= 00:00 local do dia 1º).
      expect(
        canDeleteByMonth({
          recordDate: new Date('2026-08-01T03:00:00.000Z'),
          kind: 'utc-instant',
          isSuperuser: false,
          now,
        }),
      ).toBe(true);
    });

    it('nas 3h iniciais do dia 1º, o mês local já virou mas o UTC do registro não', () => {
      // Agora: 01/07 00:30 local = 01/07 03:30 UTC → mês local é julho.
      const now = new Date('2026-07-01T03:30:00.000Z');
      // Registro com created_at 30/06 23:00 UTC → mês UTC é junho.
      expect(
        canDeleteByMonth({
          recordDate: new Date('2026-06-30T23:00:00.000Z'),
          kind: 'utc-instant',
          isSuperuser: false,
          now,
        }),
      ).toBe(false);
    });
  });

  describe('hora de parede (atividades) — sem deslocamento', () => {
    it('atividade do mês corrente pode ser excluída', () => {
      expect(
        canDeleteByMonth({
          recordDate: parseWallClockInput('2026-07-10T08:00'),
          kind: 'wall-clock',
          isSuperuser: false,
          now: NOW,
        }),
      ).toBe(true);
    });

    it('atividade do mês anterior não pode', () => {
      expect(
        canDeleteByMonth({
          recordDate: parseWallClockInput('2026-06-30T23:00'),
          kind: 'wall-clock',
          isSuperuser: false,
          now: NOW,
        }),
      ).toBe(false);
    });

    it('atividade às 23:00 do último dia do mês continua no mês corrente', () => {
      // Sem o deslocamento de 3h que afeta created_at.
      const now = new Date('2026-07-31T23:30:00.000Z'); // 20:30 local, 31/07
      expect(
        canDeleteByMonth({
          recordDate: parseWallClockInput('2026-07-31T23:00'),
          kind: 'wall-clock',
          isSuperuser: false,
          now,
        }),
      ).toBe(true);
    });
  });

  describe('viradas de ano', () => {
    it('dezembro e janeiro são meses distintos', () => {
      const nowJanuary = new Date('2027-01-15T15:00:00.000Z');
      expect(
        canDeleteByMonth({
          recordDate: new Date('2026-12-31T12:00:00.000Z'),
          kind: 'utc-instant',
          isSuperuser: false,
          now: nowJanuary,
        }),
      ).toBe(false);
    });

    it('janeiro do ano corrente é permitido', () => {
      const nowJanuary = new Date('2027-01-15T15:00:00.000Z');
      expect(
        canDeleteByMonth({
          recordDate: new Date('2027-01-02T12:00:00.000Z'),
          kind: 'utc-instant',
          isSuperuser: false,
          now: nowJanuary,
        }),
      ).toBe(true);
    });
  });
});
