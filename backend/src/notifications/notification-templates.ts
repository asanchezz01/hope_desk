import { statusLabel } from '../common/domain/legacy-enums';
import { formatWallClockPtBr } from '../common/time/legacy-clock';
import {
  ActivityCreatedEvent,
  PasswordResetRequestedEvent,
  TicketCreatedEvent,
  TicketStatusChangedEvent,
} from '../common/events/domain-events';
import { OutgoingEmail } from './mailer.service';

/**
 * Corpos de e-mail, transcritos de `notify_*` e `send_password_reset_email` do
 * legado.
 *
 * O legado escreve **sem acentos** nos corpos (provavelmente para evitar
 * problemas de encoding no SMTP). Isso é preservado: o objetivo desta fase é
 * paridade, não melhoria de texto. Os assuntos também são idênticos.
 *
 * Funções puras: recebem o evento e a URL, devolvem o e-mail. Testáveis sem
 * SMTP e sem banco.
 */

/** `build_ticket_external_url` do legado, apontando para o frontend novo. */
export function buildTicketUrl(appPublicUrl: string, ticketId: number): string {
  return `${appPublicUrl.replace(/\/$/, '')}/tickets/${ticketId}`;
}

export function buildResetPasswordUrl(appPublicUrl: string, token: string): string {
  return `${appPublicUrl.replace(/\/$/, '')}/reset-password/${encodeURIComponent(token)}`;
}

/** `notify_technicians_new_ticket`. Destinatários resolvidos pelo handler. */
export function newTicketEmail(
  event: TicketCreatedEvent,
  recipients: string[],
  ticketUrl: string,
): OutgoingEmail {
  return {
    recipients,
    subject: `[Hope Desk] Novo chamado #${event.ticketId}: ${event.title}`,
    body:
      'Novo chamado recebido no Hope Desk.\n\n' +
      `Chamado #${event.ticketId}\n` +
      `Titulo: ${event.title}\n` +
      `Cliente: ${event.clientName}\n` +
      `Descricao:\n${event.description}\n\n` +
      `Acesse o chamado diretamente: ${ticketUrl}`,
  };
}

/** `notify_client_status_changed`. Somente o cliente do chamado. */
export function statusChangedEmail(
  event: TicketStatusChangedEvent,
  ticketUrl: string,
): OutgoingEmail {
  return {
    recipients: [event.clientEmail],
    subject: `[Hope Desk] Atualizacao de status do chamado #${event.ticketId}`,
    body:
      'O status do seu chamado foi atualizado.\n\n' +
      `Chamado #${event.ticketId}\n` +
      `Titulo: ${event.title}\n` +
      // O legado envia o valor cru do status, não o rótulo.
      `Status anterior: ${event.previousStatus}\n` +
      `Novo status: ${event.newStatus}\n\n` +
      `Acesse o chamado diretamente: ${ticketUrl}`,
  };
}

/** `notify_client_new_activity`. Somente o cliente do chamado. */
export function newActivityEmail(
  event: ActivityCreatedEvent,
  ticketUrl: string,
): OutgoingEmail {
  return {
    recipients: [event.clientEmail],
    subject: `[Hope Desk] Nova tarefa no chamado #${event.ticketId}`,
    body:
      'Uma nova tarefa/atividade foi registrada no seu chamado.\n\n' +
      `Chamado #${event.ticketId}\n` +
      `Titulo: ${event.ticketTitle}\n` +
      `Tecnico: ${event.technicianName}\n` +
      // dd/mm/aaaa HH:MM, como o strftime do legado.
      `Inicio: ${formatWallClockPtBr(event.startedAt)}\n` +
      `Fim: ${formatWallClockPtBr(event.endedAt)}\n` +
      `Descricao da atividade:\n${event.notes}\n\n` +
      `Acesse o chamado diretamente: ${ticketUrl}`,
  };
}

/** `send_password_reset_email`. Validade de 2 horas, como o legado. */
export function passwordResetEmail(
  event: PasswordResetRequestedEvent,
  resetUrl: string,
  maxAgeHours: number,
): OutgoingEmail {
  return {
    recipients: [event.email],
    subject: '[Hope Desk] Troca de senha',
    body:
      `Ola, ${event.name}.\n\n` +
      'Recebemos uma solicitacao para troca da sua senha no Hope Desk.\n\n' +
      `Para definir uma nova senha, acesse o link abaixo (valido por ${maxAgeHours} horas):\n` +
      `${resetUrl}\n\n` +
      'Se voce nao solicitou a troca de senha, ignore este e-mail. ' +
      'Sua senha atual continua valida.',
  };
}

/** Exportado para uso em relatórios e telas; não usado nos corpos do legado. */
export { statusLabel };
