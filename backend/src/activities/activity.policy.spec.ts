import { AuthenticatedUser } from '../auth/auth.types';
import { parseWallClockInput } from '../common/time/legacy-clock';
import {
  canCreateActivity,
  canDeleteActivity,
  canEditActivity,
} from './activity.policy';

const CLIENT: AuthenticatedUser = {
  id: 10,
  email: 'cliente@example.com',
  role: 'client',
  isSuperuser: false,
  mustChangePassword: false,
};

const TECHNICIAN: AuthenticatedUser = {
  id: 20,
  email: 'ana@example.com',
  role: 'technician',
  isSuperuser: false,
  mustChangePassword: false,
};

const OTHER_TECHNICIAN: AuthenticatedUser = {
  id: 21,
  email: 'bruno@example.com',
  role: 'technician',
  isSuperuser: false,
  mustChangePassword: false,
};

const SUPERUSER: AuthenticatedUser = {
  id: 30,
  email: 'super@example.com',
  role: 'technician',
  isSuperuser: true,
  mustChangePassword: false,
};

describe('activity.policy', () => {
  describe('canCreateActivity', () => {
    it('cliente não registra atividade', () => {
      expect(canCreateActivity(CLIENT)).toBe(false);
    });

    it.each([
      ['técnico', TECHNICIAN],
      ['superuser', SUPERUSER],
    ])('%s registra atividade', (_label, user) => {
      expect(canCreateActivity(user)).toBe(true);
    });
  });

  describe('canEditActivity — somente o autor', () => {
    const ownActivity = { createdById: TECHNICIAN.id };
    const foreignActivity = { createdById: OTHER_TECHNICIAN.id };

    it('o autor edita a própria atividade', () => {
      expect(canEditActivity(TECHNICIAN, ownActivity)).toBe(true);
    });

    it('outro técnico NÃO edita atividade alheia', () => {
      expect(canEditActivity(TECHNICIAN, foreignActivity)).toBe(false);
    });

    /**
     * A regra mais contraintuitiva do sistema: em todo o resto o superuser
     * contorna as restrições, mas `edit_activity` compara `created_by_id` com o
     * usuário da sessão sem consultar `is_superuser`.
     */
    it('superuser NÃO edita atividade de outro técnico', () => {
      expect(canEditActivity(SUPERUSER, foreignActivity)).toBe(false);
      expect(canEditActivity(SUPERUSER, ownActivity)).toBe(false);
    });

    it('superuser edita a própria atividade', () => {
      expect(canEditActivity(SUPERUSER, { createdById: SUPERUSER.id })).toBe(true);
    });

    it('cliente não edita nem atividade que tivesse criado', () => {
      expect(canEditActivity(CLIENT, { createdById: CLIENT.id })).toBe(false);
    });
  });

  describe('canDeleteActivity — janela de mês, sem exigir autoria', () => {
    /** 15/07/2026 12:00 em São Paulo. */
    const NOW = new Date('2026-07-15T15:00:00.000Z');
    const currentMonth = { startedAt: parseWallClockInput('2026-07-10T08:00') };
    const previousMonth = { startedAt: parseWallClockInput('2026-06-10T08:00') };

    it('cliente nunca exclui', () => {
      expect(canDeleteActivity(CLIENT, currentMonth, NOW)).toBe(false);
    });

    it('técnico exclui atividade do mês corrente', () => {
      expect(canDeleteActivity(TECHNICIAN, currentMonth, NOW)).toBe(true);
    });

    it('técnico exclui atividade do mês corrente lançada por OUTRO', () => {
      // Diferente da edição, o legado não exige autoria para excluir.
      expect(canDeleteActivity(OTHER_TECHNICIAN, currentMonth, NOW)).toBe(true);
    });

    it('técnico NÃO exclui atividade de mês anterior', () => {
      expect(canDeleteActivity(TECHNICIAN, previousMonth, NOW)).toBe(false);
    });

    it('superuser exclui atividade histórica', () => {
      expect(canDeleteActivity(SUPERUSER, previousMonth, NOW)).toBe(true);
      expect(
        canDeleteActivity(
          SUPERUSER,
          { startedAt: parseWallClockInput('2020-01-01T08:00') },
          NOW,
        ),
      ).toBe(true);
    });

    it('a janela usa hora de parede, sem a distorção de 3h dos chamados', () => {
      // 31/07 23:00 de parede continua sendo julho.
      const now = new Date('2026-07-31T23:30:00.000Z');
      expect(
        canDeleteActivity(
          TECHNICIAN,
          { startedAt: parseWallClockInput('2026-07-31T23:00') },
          now,
        ),
      ).toBe(true);
    });
  });
});
