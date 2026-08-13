"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTIVITY_DELETE_WINDOW_MESSAGE = exports.TICKET_DELETE_WINDOW_MESSAGE = exports.canDeleteByMonth = void 0;
const legacy_clock_1 = require("../time/legacy-clock");
function canDeleteByMonth(context) {
    if (context.isSuperuser) {
        return true;
    }
    const record = (0, legacy_clock_1.storageToWallClock)(context.recordDate);
    const now = (0, legacy_clock_1.instantToWallClockParts)(context.now ?? new Date());
    return record.year === now.year && record.month === now.month;
}
exports.canDeleteByMonth = canDeleteByMonth;
exports.TICKET_DELETE_WINDOW_MESSAGE = 'Somente chamados do mês corrente podem ser excluídos. ' +
    'Para meses anteriores, apenas superuser pode excluir.';
exports.ACTIVITY_DELETE_WINDOW_MESSAGE = 'Somente atividades do mês corrente podem ser excluídas. ' +
    'Para meses anteriores, apenas superuser pode excluir.';
//# sourceMappingURL=deletion-window.js.map