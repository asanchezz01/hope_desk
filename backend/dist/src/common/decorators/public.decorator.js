"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllowPasswordChangePending = exports.ALLOW_PASSWORD_CHANGE_PENDING_KEY = exports.Public = exports.IS_PUBLIC_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.IS_PUBLIC_KEY = 'isPublic';
const Public = () => (0, common_1.SetMetadata)(exports.IS_PUBLIC_KEY, true);
exports.Public = Public;
exports.ALLOW_PASSWORD_CHANGE_PENDING_KEY = 'allowPasswordChangePending';
const AllowPasswordChangePending = () => (0, common_1.SetMetadata)(exports.ALLOW_PASSWORD_CHANGE_PENDING_KEY, true);
exports.AllowPasswordChangePending = AllowPasswordChangePending;
//# sourceMappingURL=public.decorator.js.map