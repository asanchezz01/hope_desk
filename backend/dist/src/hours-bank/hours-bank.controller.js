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
exports.HoursBankController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const hours_bank_dto_1 = require("./dto/hours-bank.dto");
const hours_bank_service_1 = require("./hours-bank.service");
let HoursBankController = class HoursBankController {
    constructor(hoursBankService) {
        this.hoursBankService = hoursBankService;
    }
    getHoursBank(user, query) {
        return this.hoursBankService.getHoursBank(user, query);
    }
    getMonthlySummary(user, query) {
        return this.hoursBankService.getMonthlySummary(user, query);
    }
};
exports.HoursBankController = HoursBankController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Saldo do banco de horas no ciclo corrente',
        description: 'Ciclo semestral a partir de `hours_bank_closing_date`. O excesso é ' +
            'calculado mês a mês (sem compensar entre meses), as horas pagas do ciclo ' +
            'são descontadas e o saldo nunca fica negativo.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: hours_bank_dto_1.HoursBankResponse }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, hours_bank_dto_1.HoursBankQueryDto]),
    __metadata("design:returntype", Promise)
], HoursBankController.prototype, "getHoursBank", null);
__decorate([
    (0, common_1.Get)('monthly-summary'),
    (0, swagger_1.ApiOperation)({
        summary: 'Resumo de horas de um mês',
        description: 'Inclui as horas de atividades do mês ligadas a chamados criados em ' +
            'outros meses, e as horas pagas no mês.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: hours_bank_dto_1.MonthlyHoursSummaryResponse }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, hours_bank_dto_1.HoursBankQueryDto]),
    __metadata("design:returntype", Promise)
], HoursBankController.prototype, "getMonthlySummary", null);
exports.HoursBankController = HoursBankController = __decorate([
    (0, swagger_1.ApiTags)('hours-bank'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('hours-bank'),
    __metadata("design:paramtypes", [hours_bank_service_1.HoursBankService])
], HoursBankController);
//# sourceMappingURL=hours-bank.controller.js.map