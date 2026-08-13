"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTicketClientId = exports.canDeleteTicket = exports.canViewTicket = exports.canChangeStatus = exports.canEditTicket = exports.canCreateForOtherClient = void 0;
const deletion_window_1 = require("../common/domain/deletion-window");
function canCreateForOtherClient(user) {
    return user.role === 'technician' || user.isSuperuser;
}
exports.canCreateForOtherClient = canCreateForOtherClient;
function canEditTicket(user) {
    return user.role === 'technician' || user.isSuperuser;
}
exports.canEditTicket = canEditTicket;
function canChangeStatus(user) {
    return canEditTicket(user);
}
exports.canChangeStatus = canChangeStatus;
function canViewTicket(user, ticket) {
    if (user.role === 'client') {
        return ticket.clientId === user.id;
    }
    return true;
}
exports.canViewTicket = canViewTicket;
function canDeleteTicket(user, ticket, now) {
    if (!canEditTicket(user))
        return false;
    return (0, deletion_window_1.canDeleteByMonth)({
        recordDate: ticket.createdAt,
        kind: 'utc-instant',
        isSuperuser: user.isSuperuser,
        now,
    });
}
exports.canDeleteTicket = canDeleteTicket;
function resolveTicketClientId(user, requestedClientId) {
    if (canCreateForOtherClient(user)) {
        return {
            clientId: requestedClientId ?? null,
            requiresExplicitClient: true,
        };
    }
    return { clientId: user.id, requiresExplicitClient: false };
}
exports.resolveTicketClientId = resolveTicketClientId;
//# sourceMappingURL=ticket.policy.js.map