"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isClient = exports.isTechnician = void 0;
function isTechnician(user) {
    return user.role === 'technician';
}
exports.isTechnician = isTechnician;
function isClient(user) {
    return user.role === 'client';
}
exports.isClient = isClient;
//# sourceMappingURL=auth.types.js.map