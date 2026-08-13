"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordService = exports.BCRYPT_ROUNDS = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcryptjs"));
const werkzeug_hash_1 = require("./werkzeug-hash");
exports.BCRYPT_ROUNDS = 12;
let PasswordService = class PasswordService {
    async hash(plainPassword) {
        return bcrypt.hash(plainPassword, exports.BCRYPT_ROUNDS);
    }
    async verify(plainPassword, storedHash) {
        if (!plainPassword || !storedHash) {
            return { valid: false, needsRehash: false };
        }
        if ((0, werkzeug_hash_1.isWerkzeugHash)(storedHash)) {
            const valid = (0, werkzeug_hash_1.checkWerkzeugPassword)(plainPassword, storedHash);
            return { valid, needsRehash: valid };
        }
        try {
            const valid = await bcrypt.compare(plainPassword, storedHash);
            return { valid, needsRehash: false };
        }
        catch {
            return { valid: false, needsRehash: false };
        }
    }
    async spendDummyWork() {
        await bcrypt.compare('senha-inexistente', DUMMY_BCRYPT_HASH);
    }
};
exports.PasswordService = PasswordService;
exports.PasswordService = PasswordService = __decorate([
    (0, common_1.Injectable)()
], PasswordService);
const DUMMY_BCRYPT_HASH = '$2a$12$LTecAEQxUp9Jj7n1UNJt3e9h6Uzb7m3NYyE6aLznD9Grt5Tagrene';
//# sourceMappingURL=password.service.js.map