"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequiresSuperuser = exports.REQUIRES_SUPERUSER_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.REQUIRES_SUPERUSER_KEY = 'requiresSuperuser';
const RequiresSuperuser = () => (0, common_1.SetMetadata)(exports.REQUIRES_SUPERUSER_KEY, true);
exports.RequiresSuperuser = RequiresSuperuser;
//# sourceMappingURL=superuser.decorator.js.map