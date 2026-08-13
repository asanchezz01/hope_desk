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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemModulesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const superuser_decorator_1 = require("../common/decorators/superuser.decorator");
const system_module_dto_1 = require("./dto/system-module.dto");
const system_modules_service_1 = require("./system-modules.service");
let SystemModulesController = class SystemModulesController {
    constructor(systemModulesService) {
        this.systemModulesService = systemModulesService;
    }
    listActive() {
        return this.systemModulesService.listActive();
    }
    list(query) {
        return this.systemModulesService.list(query);
    }
    findOne(id) {
        return this.systemModulesService.findOne(id);
    }
    create(dto) {
        return this.systemModulesService.create(dto);
    }
    update(id, dto) {
        return this.systemModulesService.update(id, dto);
    }
    toggle(id) {
        return this.systemModulesService.toggle(id);
    }
    remove(id) {
        return this.systemModulesService.remove(id);
    }
};
exports.SystemModulesController = SystemModulesController;
__decorate([
    (0, common_1.Get)('active'),
    (0, swagger_1.ApiOperation)({
        summary: 'Lista módulos ativos (qualquer usuário autenticado)',
        description: 'Usado na abertura de chamado, que exige módulo ativo.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: [system_module_dto_1.SystemModuleResponse] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SystemModulesController.prototype, "listActive", null);
__decorate([
    (0, common_1.Get)(),
    (0, superuser_decorator_1.RequiresSuperuser)(),
    (0, swagger_1.ApiOperation)({ summary: 'Lista módulos (paginado, superuser)' }),
    (0, swagger_1.ApiOkResponse)({ type: system_module_dto_1.PaginatedSystemModulesResponse }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [system_module_dto_1.ListSystemModulesQueryDto]),
    __metadata("design:returntype", Promise)
], SystemModulesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, superuser_decorator_1.RequiresSuperuser)(),
    (0, swagger_1.ApiOperation)({ summary: 'Detalha um módulo (superuser)' }),
    (0, swagger_1.ApiOkResponse)({ type: system_module_dto_1.SystemModuleResponse }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SystemModulesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, superuser_decorator_1.RequiresSuperuser)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Cadastra um módulo (superuser)',
        description: 'Nome é único sem diferenciar maiúsculas, como no legado.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: system_module_dto_1.SystemModuleResponse }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [system_module_dto_1.CreateSystemModuleDto]),
    __metadata("design:returntype", Promise)
], SystemModulesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, superuser_decorator_1.RequiresSuperuser)(),
    (0, swagger_1.ApiOperation)({ summary: 'Atualiza nome ou situação de um módulo (superuser)' }),
    (0, swagger_1.ApiOkResponse)({ type: system_module_dto_1.SystemModuleResponse }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, system_module_dto_1.UpdateSystemModuleDto]),
    __metadata("design:returntype", Promise)
], SystemModulesController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/toggle'),
    (0, superuser_decorator_1.RequiresSuperuser)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Ativa ou desativa um módulo (superuser)' }),
    (0, swagger_1.ApiOkResponse)({ type: system_module_dto_1.SystemModuleResponse }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SystemModulesController.prototype, "toggle", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, superuser_decorator_1.RequiresSuperuser)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({
        summary: 'Exclui um módulo sem chamados vinculados (superuser)',
        description: 'Com chamados vinculados, desative em vez de excluir.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SystemModulesController.prototype, "remove", null);
exports.SystemModulesController = SystemModulesController = __decorate([
    (0, swagger_1.ApiTags)('system-modules'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('system-modules'),
    __metadata("design:paramtypes", [system_modules_service_1.SystemModulesService])
], SystemModulesController);
//# sourceMappingURL=system-modules.controller.js.map