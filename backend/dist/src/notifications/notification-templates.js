"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusLabel = exports.passwordResetEmail = exports.newActivityEmail = exports.statusChangedEmail = exports.newTicketEmail = exports.buildResetPasswordUrl = exports.buildTicketUrl = void 0;
const legacy_enums_1 = require("../common/domain/legacy-enums");
Object.defineProperty(exports, "statusLabel", { enumerable: true, get: function () { return legacy_enums_1.statusLabel; } });
const legacy_clock_1 = require("../common/time/legacy-clock");
function buildTicketUrl(appPublicUrl, ticketId) {
    return `${appPublicUrl.replace(/\/$/, '')}/tickets/${ticketId}`;
}
exports.buildTicketUrl = buildTicketUrl;
function buildResetPasswordUrl(appPublicUrl, token) {
    return `${appPublicUrl.replace(/\/$/, '')}/reset-password/${encodeURIComponent(token)}`;
}
exports.buildResetPasswordUrl = buildResetPasswordUrl;
function newTicketEmail(event, recipients, ticketUrl) {
    return {
        recipients,
        subject: `[Hope Desk] Novo chamado #${event.ticketId}: ${event.title}`,
        body: 'Novo chamado recebido no Hope Desk.\n\n' +
            `Chamado #${event.ticketId}\n` +
            `Titulo: ${event.title}\n` +
            `Cliente: ${event.clientName}\n` +
            `Descricao:\n${event.description}\n\n` +
            `Acesse o chamado diretamente: ${ticketUrl}`,
    };
}
exports.newTicketEmail = newTicketEmail;
function statusChangedEmail(event, ticketUrl) {
    return {
        recipients: [event.clientEmail],
        subject: `[Hope Desk] Atualizacao de status do chamado #${event.ticketId}`,
        body: 'O status do seu chamado foi atualizado.\n\n' +
            `Chamado #${event.ticketId}\n` +
            `Titulo: ${event.title}\n` +
            `Status anterior: ${event.previousStatus}\n` +
            `Novo status: ${event.newStatus}\n\n` +
            `Acesse o chamado diretamente: ${ticketUrl}`,
    };
}
exports.statusChangedEmail = statusChangedEmail;
function newActivityEmail(event, ticketUrl) {
    return {
        recipients: [event.clientEmail],
        subject: `[Hope Desk] Nova tarefa no chamado #${event.ticketId}`,
        body: 'Uma nova tarefa/atividade foi registrada no seu chamado.\n\n' +
            `Chamado #${event.ticketId}\n` +
            `Titulo: ${event.ticketTitle}\n` +
            `Tecnico: ${event.technicianName}\n` +
            `Inicio: ${(0, legacy_clock_1.formatWallClockPtBr)(event.startedAt)}\n` +
            `Fim: ${(0, legacy_clock_1.formatWallClockPtBr)(event.endedAt)}\n` +
            `Descricao da atividade:\n${event.notes}\n\n` +
            `Acesse o chamado diretamente: ${ticketUrl}`,
    };
}
exports.newActivityEmail = newActivityEmail;
function passwordResetEmail(event, resetUrl, maxAgeHours) {
    return {
        recipients: [event.email],
        subject: '[Hope Desk] Troca de senha',
        body: `Ola, ${event.name}.\n\n` +
            'Recebemos uma solicitacao para troca da sua senha no Hope Desk.\n\n' +
            `Para definir uma nova senha, acesse o link abaixo (valido por ${maxAgeHours} horas):\n` +
            `${resetUrl}\n\n` +
            'Se voce nao solicitou a troca de senha, ignore este e-mail. ' +
            'Sua senha atual continua valida.',
    };
}
exports.passwordResetEmail = passwordResetEmail;
//# sourceMappingURL=notification-templates.js.map