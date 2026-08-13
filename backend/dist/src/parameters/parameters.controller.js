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
exports.ParametersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const superuser_decorator_1 = require("../common/decorators/superuser.decorator");
const parameter_dto_1 = require("./dto/parameter.dto");
const parameters_service_1 = require("./parameters.service");
let ParametersController = class ParametersController {
    constructor(parametersService) {
        this.parametersService = parametersService;
    }
    findPublic() {
        return this.parametersService.findPublic();
    }
    findAll() {
        return this.parametersService.findAll();
    }
    update(dto) {
        return this.parametersService.update(dto);
    }
};
exports.ParametersController = ParametersController;
__decorate([
    (0, common_1.Get)('public'),
    (0, swagger_1.ApiOperation)({
        summary: 'Nome, endereço e logo da empresa (qualquer usuário autenticado)',
    }),
    (0, swagger_1.ApiOkResponse)({ type: parameter_dto_1.PublicCompanyParametersResponse }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ParametersController.prototype, "findPublic", null);
__decorate([
    (0, common_1.Get)(),
    (0, superuser_decorator_1.RequiresSuperuser)(),
    (0, swagger_1.ApiOperation)({ summary: 'Todos os parâmetros da empresa (superuser)' }),
    (0, swagger_1.ApiOkResponse)({ type: parameter_dto_1.CompanyParametersResponse }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ParametersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Patch)(),
    (0, superuser_decorator_1.RequiresSuperuser)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Atualiza os parâmetros da empresa (superuser)',
        description: 'A franquia mensal aceita vírgula decimal e é gravada com 2 casas. ' +
            'A data de fechamento usa AAAA-MM-DD.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: parameter_dto_1.CompanyParametersResponse }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [parameter_dto_1.UpdateCompanyParametersDto]),
    __metadata("design:returntype", Promise)
], ParametersController.prototype, "update", null);
exports.ParametersController = ParametersController = __decorate([
    (0, swagger_1.ApiTags)('parameters'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('parameters'),
    __metadata("design:paramtypes", [parameters_service_1.ParametersService])
], ParametersController);
//# sourceMappingURL=parameters.controller.js.map