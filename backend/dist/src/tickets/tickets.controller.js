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
exports.TicketsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const ticket_dto_1 = require("./dto/ticket.dto");
const tickets_service_1 = require("./tickets.service");
let TicketsController = class TicketsController {
    constructor(ticketsService) {
        this.ticketsService = ticketsService;
    }
    list(user, query) {
        return this.ticketsService.list(user, query);
    }
    availableYears(user) {
        return this.ticketsService.availableYears(user);
    }
    findOne(user, id) {
        return this.ticketsService.findOne(user, id);
    }
    create(user, dto) {
        return this.ticketsService.create(user, dto);
    }
    update(user, id, dto) {
        return this.ticketsService.update(user, id, dto);
    }
    changeStatus(user, id, dto) {
        return this.ticketsService.changeStatus(user, id, dto);
    }
    remove(user, id) {
        return this.ticketsService.remove(user, id);
    }
};
exports.TicketsController = TicketsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Lista chamados (paginado)',
        description: 'Cliente vê apenas os próprios chamados. Filtros de período (ano/mês de ' +
            'criação) e status seguem o dashboard do legado, com `nao_concluidos` ' +
            'como default.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: ticket_dto_1.PaginatedTicketsResponse }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ticket_dto_1.ListTicketsQueryDto]),
    __metadata("design:returntype", Promise)
], TicketsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('available-years'),
    (0, swagger_1.ApiOperation)({
        summary: 'Anos com chamados no escopo do usuário',
        description: 'Inclui sempre o ano corrente, como o seletor do legado.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: [Number] }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TicketsController.prototype, "availableYears", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Detalha um chamado',
        description: 'Cliente que tenta acessar chamado de outro recebe 404, não 403 — a API ' +
            'não revela a existência de chamados alheios.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: ticket_dto_1.TicketResponse }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], TicketsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Abre um chamado',
        description: 'Cliente abre para si (qualquer `clientId` enviado é ignorado). ' +
            'Técnico e superuser precisam informar o cliente. O módulo é obrigatório ' +
            'e precisa estar ATIVO.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: ticket_dto_1.TicketResponse }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ticket_dto_1.CreateTicketDto]),
    __metadata("design:returntype", Promise)
], TicketsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Edita um chamado (técnico ou superuser)',
        description: 'Diferente da criação, o módulo informado **pode estar inativo** — é o ' +
            'comportamento do legado, para não travar chamados antigos.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: ticket_dto_1.TicketResponse }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, ticket_dto_1.UpdateTicketDto]),
    __metadata("design:returntype", Promise)
], TicketsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/status'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Altera o status de um chamado (técnico ou superuser)' }),
    (0, swagger_1.ApiOkResponse)({ type: ticket_dto_1.TicketResponse }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, ticket_dto_1.ChangeTicketStatusDto]),
    __metadata("design:returntype", Promise)
], TicketsController.prototype, "changeStatus", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({
        summary: 'Exclui um chamado',
        description: 'Técnico exclui apenas chamados do mês corrente; meses anteriores ' +
            'somente superuser. As atividades caem em cascata.',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], TicketsController.prototype, "remove", null);
exports.TicketsController = TicketsController = __decorate([
    (0, swagger_1.ApiTags)('tickets'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('tickets'),
    __metadata("design:paramtypes", [tickets_service_1.TicketsService])
], TicketsController);
//# sourceMappingURL=tickets.controller.js.map