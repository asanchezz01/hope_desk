import { parseWallClockInput } from '../common/time/legacy-clock';
import {
  buildResetPasswordUrl,
  buildTicketUrl,
  newActivityEmail,
  newTicketEmail,
  passwordResetEmail,
  statusChangedEmail,
} from './notification-templates';

const APP_URL = 'https://app.hope.com';

describe('notification-templates', () => {
  describe('URLs', () => {
    it('monta a URL do chamado', () => {
      expect(buildTicketUrl(APP_URL, 42)).toBe('https://app.hope.com/tickets/42');
    });

    it('não duplica a barra final', () => {
      expect(buildTicketUrl('https://app.hope.com/', 42)).toBe(
        'https://app.hope.com/tickets/42',
      );
    });

    it('codifica o token na URL de redefinição', () => {
      const url = buildResetPasswordUrl(APP_URL, 'abc-_123');
      expect(url).toBe('https://app.hope.com/reset-password/abc-_123');
    });

    it('escapa caracteres especiais do token', () => {
      expect(buildResetPasswordUrl(APP_URL, 'a/b+c')).toBe(
        'https://app.hope.com/reset-password/a%2Fb%2Bc',
      );
    });
  });

  describe('novo chamado', () => {
    const event = {
      ticketId: 7,
      title: 'Impressora parou',
      description: 'Não imprime nada.',
      clientId: 1,
      clientName: 'Cliente Um',
      clientEmail: 'cliente@example.com',
      technicianId: null,
    };

    it('usa o assunto do legado', () => {
      const email = newTicketEmail(event, ['tec@example.com'], 'https://x/tickets/7');
      expect(email.subject).toBe('[Hope Desk] Novo chamado #7: Impressora parou');
    });

    it('inclui cliente, descrição e link no corpo', () => {
      const email = newTicketEmail(event, ['tec@example.com'], 'https://x/tickets/7');
      expect(email.body).toContain('Chamado #7');
      expect(email.body).toContain('Titulo: Impressora parou');
      expect(email.body).toContain('Cliente: Cliente Um');
      expect(email.body).toContain('Não imprime nada.');
      expect(email.body).toContain('https://x/tickets/7');
    });

    it('respeita a lista de destinatários informada', () => {
      const email = newTicketEmail(
        event,
        ['a@example.com', 'b@example.com'],
        'https://x/tickets/7',
      );
      expect(email.recipients).toEqual(['a@example.com', 'b@example.com']);
    });
  });

  describe('mudança de status', () => {
    const event = {
      ticketId: 7,
      title: 'Impressora parou',
      previousStatus: 'aberto',
      newStatus: 'em_andamento',
      clientId: 1,
      clientName: 'Cliente Um',
      clientEmail: 'cliente@example.com',
    };

    it('vai somente para o cliente', () => {
      const email = statusChangedEmail(event, 'https://x/tickets/7');
      expect(email.recipients).toEqual(['cliente@example.com']);
    });

    it('usa o assunto do legado', () => {
      const email = statusChangedEmail(event, 'https://x/tickets/7');
      expect(email.subject).toBe('[Hope Desk] Atualizacao de status do chamado #7');
    });

    it('envia os valores CRUS de status, como o legado', () => {
      const email = statusChangedEmail(event, 'https://x/tickets/7');
      expect(email.body).toContain('Status anterior: aberto');
      expect(email.body).toContain('Novo status: em_andamento');
      // Não usa o rótulo de apresentação.
      expect(email.body).not.toContain('Em andamento');
    });
  });

  describe('nova atividade', () => {
    const event = {
      activityId: 3,
      ticketId: 7,
      ticketTitle: 'Impressora parou',
      notes: 'Troquei o toner.',
      startedAt: parseWallClockInput('2026-03-10T08:30'),
      endedAt: parseWallClockInput('2026-03-10T10:45'),
      technicianId: 2,
      technicianName: 'Técnico Um',
      clientId: 1,
      clientName: 'Cliente Um',
      clientEmail: 'cliente@example.com',
    };

    it('vai somente para o cliente', () => {
      const email = newActivityEmail(event, 'https://x/tickets/7');
      expect(email.recipients).toEqual(['cliente@example.com']);
    });

    it('usa o assunto do legado', () => {
      const email = newActivityEmail(event, 'https://x/tickets/7');
      expect(email.subject).toBe('[Hope Desk] Nova tarefa no chamado #7');
    });

    it('formata início e fim como dd/mm/aaaa HH:MM em hora de parede', () => {
      const email = newActivityEmail(event, 'https://x/tickets/7');
      // Sem deslocamento de fuso: a parede é exatamente o que foi informado.
      expect(email.body).toContain('Inicio: 10/03/2026 08:30');
      expect(email.body).toContain('Fim: 10/03/2026 10:45');
    });

    it('inclui técnico e descrição da atividade', () => {
      const email = newActivityEmail(event, 'https://x/tickets/7');
      expect(email.body).toContain('Tecnico: Técnico Um');
      expect(email.body).toContain('Troquei o toner.');
    });
  });

  describe('recuperação de senha', () => {
    const event = {
      userId: 1,
      name: 'Cliente Um',
      email: 'cliente@example.com',
      token: 'token-secreto',
      expiresAt: new Date('2026-03-10T12:00:00Z'),
    };

    it('vai somente para o próprio usuário', () => {
      const email = passwordResetEmail(event, 'https://x/reset/token-secreto', 2);
      expect(email.recipients).toEqual(['cliente@example.com']);
    });

    it('usa o assunto do legado', () => {
      const email = passwordResetEmail(event, 'https://x/reset/token-secreto', 2);
      expect(email.subject).toBe('[Hope Desk] Troca de senha');
    });

    it('informa a validade de 2 horas', () => {
      const email = passwordResetEmail(event, 'https://x/reset/token-secreto', 2);
      expect(email.body).toContain('valido por 2 horas');
    });

    it('inclui o nome e o link', () => {
      const email = passwordResetEmail(event, 'https://x/reset/token-secreto', 2);
      expect(email.body).toContain('Ola, Cliente Um.');
      expect(email.body).toContain('https://x/reset/token-secreto');
    });

    it('avisa que a senha atual continua válida se não foi o usuário', () => {
      const email = passwordResetEmail(event, 'https://x/reset/abc', 2);
      expect(email.body).toContain('Sua senha atual continua valida');
    });
  });
});
