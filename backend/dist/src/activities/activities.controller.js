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
exports.ActivitiesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const activities_service_1 = require("./activities.service");
const activity_dto_1 = require("./dto/activity.dto");
let ActivitiesController = class ActivitiesController {
    constructor(activitiesService) {
        this.activitiesService = activitiesService;
    }
    list(user, ticketId) {
        return this.activitiesService.list(user, ticketId);
    }
    create(user, ticketId, dto) {
        return this.activitiesService.create(user, ticketId, dto);
    }
    update(user, ticketId, id, dto) {
        return this.activitiesService.update(user, ticketId, id, dto);
    }
    remove(user, ticketId, id) {
        return this.activitiesService.remove(user, ticketId, id);
    }
};
exports.ActivitiesController = ActivitiesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Lista as atividades de um chamado',
        description: 'Cliente só acessa as atividades dos próprios chamados. Ordenadas por ' +
            'início ascendente, com o total de horas.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: activity_dto_1.ActivityListResponse }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ticketId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Registra uma atividade (técnico ou superuser)',
        description: 'Início e fim são hora de parede de America/Sao_Paulo. Fim estritamente ' +
            'posterior ao início, duração máxima de 12 horas, e sem sobreposição com ' +
            'outra atividade do mesmo técnico — em qualquer chamado.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: activity_dto_1.ActivityResponse }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ticketId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, activity_dto_1.CreateActivityDto]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Edita uma atividade — SOMENTE o autor',
        description: 'Nem o superuser edita atividade lançada por outro técnico: é a regra do ' +
            '`edit_activity` do legado, preservada. A própria atividade é excluída da ' +
            'verificação de conflito.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: activity_dto_1.ActivityResponse }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ticketId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number, activity_dto_1.UpdateActivityDto]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({
        summary: 'Exclui uma atividade',
        description: 'Técnico exclui atividades do mês corrente (mesmo de outro autor); ' +
            'meses anteriores somente superuser.',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ticketId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "remove", null);
exports.ActivitiesController = ActivitiesController = __decorate([
    (0, swagger_1.ApiTags)('activities'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('tickets/:ticketId/activities'),
    __metadata("design:paramtypes", [activities_service_1.ActivitiesService])
], ActivitiesController);
//# sourceMappingURL=activities.controller.js.map