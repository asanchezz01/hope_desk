"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const token_service_1 = require("../token.service");
let JwtAuthGuard = class JwtAuthGuard {
    constructor(reflector, tokenService) {
        this.reflector = reflector;
        this.tokenService = tokenService;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic)
            return true;
        const request = context.switchToHttp().getRequest();
        const token = extractBearerToken(request);
        if (!token) {
            throw new common_1.UnauthorizedException('Autenticação obrigatória.');
        }
        const user = await this.tokenService.verifyAccessToken(token);
        if (user.mustChangePassword) {
            const allowed = this.reflector.getAllAndOverride(public_decorator_1.ALLOW_PASSWORD_CHANGE_PENDING_KEY, [context.getHandler(), context.getClass()]);
            if (!allowed) {
                throw new common_1.ForbiddenException('Você precisa definir uma nova senha antes de continuar.');
            }
        }
        request.user = user;
        return true;
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        token_service_1.TokenService])
], JwtAuthGuard);
function extractBearerToken(request) {
    const header = request.headers.authorization;
    if (!header)
        return null;
    const [scheme, value] = header.split(' ');
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !value)
        return null;
    return value.trim() || null;
}
//# sourceMappingURL=jwt-auth.guard.js.map