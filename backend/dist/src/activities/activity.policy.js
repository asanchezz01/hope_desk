"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canDeleteActivity = exports.canEditActivity = exports.canCreateActivity = void 0;
const deletion_window_1 = require("../common/domain/deletion-window");
function canCreateActivity(user) {
    return user.role === 'technician' || user.isSuperuser;
}
exports.canCreateActivity = canCreateActivity;
function canEditActivity(user, activity) {
    if (!canCreateActivity(user))
        return false;
    return activity.createdById === user.id;
}
exports.canEditActivity = canEditActivity;
function canDeleteActivity(user, activity, now) {
    if (!canCreateActivity(user))
        return false;
    return (0, deletion_window_1.canDeleteByMonth)({
        recordDate: activity.startedAt,
        kind: 'wall-clock',
        isSuperuser: user.isSuperuser,
        now,
    });
}
exports.canDeleteActivity = canDeleteActivity;
//# sourceMappingURL=activity.policy.js.map