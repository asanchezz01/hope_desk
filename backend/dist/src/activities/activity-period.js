"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityDurationHours = exports.findActivityConflict = exports.intervalsOverlap = exports.validateActivityPeriod = exports.PERIOD_DURATION_MESSAGE = exports.PERIOD_ORDER_MESSAGE = exports.MAX_ACTIVITY_HOURS = void 0;
const legacy_clock_1 = require("../common/time/legacy-clock");
exports.MAX_ACTIVITY_HOURS = 12;
exports.PERIOD_ORDER_MESSAGE = 'A data/hora de término deve ser posterior à data/hora de início.';
exports.PERIOD_DURATION_MESSAGE = 'A duração da atividade não pode ser superior a 12 horas.';
function validateActivityPeriod(startedAt, endedAt) {
    if (endedAt.getTime() <= startedAt.getTime()) {
        return exports.PERIOD_ORDER_MESSAGE;
    }
    const duration = (endedAt.getTime() - startedAt.getTime()) / 3_600_000;
    if (duration > exports.MAX_ACTIVITY_HOURS) {
        return exports.PERIOD_DURATION_MESSAGE;
    }
    return null;
}
exports.validateActivityPeriod = validateActivityPeriod;
function intervalsOverlap(left, right) {
    return (left.startedAt.getTime() < right.endedAt.getTime() &&
        left.endedAt.getTime() > right.startedAt.getTime());
}
exports.intervalsOverlap = intervalsOverlap;
function findActivityConflict(candidates, startedAt, endedAt, excludeActivityId) {
    const conflicts = candidates
        .filter((candidate) => candidate.id !== excludeActivityId)
        .filter((candidate) => intervalsOverlap(candidate, { startedAt, endedAt }))
        .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime());
    return conflicts[0] ?? null;
}
exports.findActivityConflict = findActivityConflict;
function activityDurationHours(startedAt, endedAt) {
    const hours = (0, legacy_clock_1.durationHours)(startedAt, endedAt);
    return Math.round((hours + Number.EPSILON) * 100) / 100;
}
exports.activityDurationHours = activityDurationHours;
//# sourceMappingURL=activity-period.js.map