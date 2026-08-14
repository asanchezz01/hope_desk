import { AuthenticatedUser } from '../auth/auth.types';
import {
  canChangeStatus,
  canCreateForOtherClient,
  canDeleteTicket,
  canEditTicket,
  canViewTicket,
  resolveTicketClientId,
} from './ticket.policy';

const CLIENT: AuthenticatedUser = {
  id: 10,
  email: 'cliente@example.com',
  role: 'client',
  isSuperuser: false,
  mustChangePassword: false,
};

const TECHNICIAN: AuthenticatedUser = {
  id: 20,
  email: 'tecnico@example.com',
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

/**
 * Superuser com role "client" não ocorre na prática (`ensure_superuser` força
 * technician), mas o legado deixaria passar por `not is_super`. Testado para
 * documentar a semântica.
 */
const SUPERUSER_AS_CLIENT: AuthenticatedUser = {
  id: 40,
  email: 'superclient@example.com',
  role: 'client',
  isSuperuser: true,
  mustChangePassword: false,
};

describe('ticket.policy', () => {
  describe('canCreateForOtherClient', () => {
    it('cliente abre chamado apenas para si', () => {
      expect(canCreateForOtherClient(CLIENT)).toBe(false);
    });

    it('técnico abre para um cliente', () => {
      expect(canCreateForOtherClient(TECHNICIAN)).toBe(true);
    });

    it('superuser abre para um cliente', () => {
      expect(canCreateForOtherClient(SUPERUSER)).toBe(true);
    });

    it('superuser com papel client também pode, como no legado', () => {
      expect(canCreateForOtherClient(SUPERUSER_AS_CLIENT)).toBe(true);
    });
  });

  describe('canEditTicket / canChangeStatus', () => {
    it('cliente não edita nem muda status', () => {
      expect(canEditTicket(CLIENT)).toBe(false);
      expect(canChangeStatus(CLIENT)).toBe(false);
    });

    it.each([
      ['técnico', TECHNICIAN],
      ['superuser', SUPERUSER],
      ['superuser com papel client', SUPERUSER_AS_CLIENT],
    ])('%s edita e muda status', (_label, user) => {
      expect(canEditTicket(user)).toBe(true);
      expect(canChangeStatus(user)).toBe(true);
    });
  });

  describe('canViewTicket', () => {
    it('cliente vê o próprio chamado', () => {
      expect(canViewTicket(CLIENT, { clientId: CLIENT.id })).toBe(true);
    });

    it('cliente NÃO vê chamado de outro cliente (IDOR)', () => {
      expect(canViewTicket(CLIENT, { clientId: 999 })).toBe(false);
    });

    it('técnico vê chamado de qualquer cliente', () => {
      expect(canViewTicket(TECHNICIAN, { clientId: 999 })).toBe(true);
    });

    it('superuser vê chamado de qualquer cliente', () => {
      expect(canViewTicket(SUPERUSER, { clientId: 999 })).toBe(true);
    });

    it('superuser com papel client ainda é limitado aos próprios', () => {
      // A checagem do legado é `role == "client"`, sem exceção para superuser.
      expect(canViewTicket(SUPERUSER_AS_CLIENT, { clientId: 999 })).toBe(false);
      expect(
        canViewTicket(SUPERUSER_AS_CLIENT, { clientId: SUPERUSER_AS_CLIENT.id }),
      ).toBe(true);
    });
  });

  describe('canDeleteTicket', () => {
    /** 15/07/2026 12:00 em São Paulo. */
    const NOW = new Date('2026-07-15T15:00:00.000Z');
    const CURRENT_MONTH = { createdAt: new Date('2026-07-10T12:00:00.000Z') };
    const PREVIOUS_MONTH = { createdAt: new Date('2026-06-10T12:00:00.000Z') };

    it('cliente nunca exclui', () => {
      expect(canDeleteTicket(CLIENT, CURRENT_MONTH, NOW)).toBe(false);
      expect(canDeleteTicket(CLIENT, PREVIOUS_MONTH, NOW)).toBe(false);
    });

    it('técnico exclui chamado do mês corrente', () => {
      expect(canDeleteTicket(TECHNICIAN, CURRENT_MONTH, NOW)).toBe(true);
    });

    it('técnico NÃO exclui chamado de mês anterior', () => {
      expect(canDeleteTicket(TECHNICIAN, PREVIOUS_MONTH, NOW)).toBe(false);
    });

    it('superuser exclui chamado histórico', () => {
      expect(canDeleteTicket(SUPERUSER, PREVIOUS_MONTH, NOW)).toBe(true);
      expect(
        canDeleteTicket(
          SUPERUSER,
          { createdAt: new Date('2020-01-01T00:00:00Z') },
          NOW,
        ),
      ).toBe(true);
    });
  });

  describe('resolveTicketClientId', () => {
    it('cliente: força o próprio ID e ignora o corpo (proteção IDOR)', () => {
      expect(resolveTicketClientId(CLIENT, 999)).toEqual({
        clientId: CLIENT.id,
        requiresExplicitClient: false,
      });
    });

    it('cliente sem clientId no corpo também usa o próprio ID', () => {
      expect(resolveTicketClientId(CLIENT, undefined)).toEqual({
        clientId: CLIENT.id,
        requiresExplicitClient: false,
      });
    });

    it('técnico: usa o cliente informado', () => {
      expect(resolveTicketClientId(TECHNICIAN, 999)).toEqual({
        clientId: 999,
        requiresExplicitClient: true,
      });
    });

    it('técnico sem cliente informado sinaliza exigência', () => {
      expect(resolveTicketClientId(TECHNICIAN, undefined)).toEqual({
        clientId: null,
        requiresExplicitClient: true,
      });
    });

    it('técnico pode abrir chamado para si mesmo se informar o próprio ID', () => {
      // Só valeria se ele também tivesse papel client; a validação de papel do
      // cliente acontece no service.
      expect(resolveTicketClientId(TECHNICIAN, TECHNICIAN.id).clientId).toBe(
        TECHNICIAN.id,
      );
    });
  });
});
