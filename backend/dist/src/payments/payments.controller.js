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
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const superuser_decorator_1 = require("../common/decorators/superuser.decorator");
const payment_dto_1 = require("./dto/payment.dto");
const payments_service_1 = require("./payments.service");
let PaymentsController = class PaymentsController {
    constructor(paymentsService) {
        this.paymentsService = paymentsService;
    }
    list(query) {
        return this.paymentsService.list(query);
    }
    findOne(id) {
        return this.paymentsService.findOne(id);
    }
    create(dto) {
        return this.paymentsService.create(dto);
    }
    remove(id) {
        return this.paymentsService.remove(id);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Lista pagamentos (paginado, superuser)',
        description: 'Aceita recorte por período em paid_at, inclusivo nas duas pontas. ' +
            'Os totais referem-se ao período inteiro, não apenas à página.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: payment_dto_1.PaginatedPaymentsResponse }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payment_dto_1.ListPaymentsQueryDto]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Detalha um pagamento (superuser)' }),
    (0, swagger_1.ApiOkResponse)({ type: payment_dto_1.PaymentResponse }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Registra um pagamento (superuser)',
        description: 'Valor e horas aceitam vírgula decimal e não podem ser negativos.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: payment_dto_1.PaymentResponse }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payment_dto_1.CreatePaymentDto]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "create", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({
        summary: 'Exclui um pagamento (superuser)',
        description: 'Sem janela temporal, como no legado — diferente de chamados e atividades.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "remove", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, swagger_1.ApiTags)('payments'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, superuser_decorator_1.RequiresSuperuser)(),
    (0, common_1.Controller)('payments'),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map