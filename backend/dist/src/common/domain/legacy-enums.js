"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusLabel = exports.isTicketStatus = exports.isUserRole = exports.SYSTEM_PARAMETER_KEYS = exports.SYSTEM_PARAMETER_DEFAULTS = exports.TICKET_STATUS_LABELS = exports.TICKET_STATUSES = exports.USER_ROLES = void 0;
exports.USER_ROLES = ['client', 'technician'];
exports.TICKET_STATUSES = [
    'aberto',
    'em_andamento',
    'resolvido',
    'fechado',
];
exports.TICKET_STATUS_LABELS = {
    aberto: 'Em aberto',
    em_andamento: 'Em andamento',
    resolvido: 'Concluído',
    fechado: 'Fechado',
};
exports.SYSTEM_PARAMETER_DEFAULTS = {
    company_logo: '',
    company_name: 'Hope Desk',
    company_address: 'Endereço não informado',
    monthly_hours_allowance: '16',
    hours_bank_closing_date: '2000-01-01',
};
exports.SYSTEM_PARAMETER_KEYS = Object.keys(exports.SYSTEM_PARAMETER_DEFAULTS);
function isUserRole(value) {
    return typeof value === 'string' && exports.USER_ROLES.includes(value);
}
exports.isUserRole = isUserRole;
function isTicketStatus(value) {
    return (typeof value === 'string' && exports.TICKET_STATUSES.includes(value));
}
exports.isTicketStatus = isTicketStatus;
function statusLabel(status) {
    if (isTicketStatus(status)) {
        return exports.TICKET_STATUS_LABELS[status];
    }
    return status
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
}
exports.statusLabel = statusLabel;
//# sourceMappingURL=legacy-enums.js.map