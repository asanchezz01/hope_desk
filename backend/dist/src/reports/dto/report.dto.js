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
exports.ServicesReportQueryDto = exports.ActivityReportQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const trim = ({ value }) => typeof value === 'string' ? value.trim() : value;
class ActivityReportQueryDto {
}
exports.ActivityReportQueryDto = ActivityReportQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Início do intervalo, AAAA-MM-DD. Default: 1º do mês corrente.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'Informe uma data inicial válida (AAAA-MM-DD).',
    }),
    __metadata("design:type", String)
], ActivityReportQueryDto.prototype, "start", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Fim do intervalo, AAAA-MM-DD. INCLUSIVO. Default: hoje.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'Informe uma data final válida (AAAA-MM-DD).',
    }),
    __metadata("design:type", String)
], ActivityReportQueryDto.prototype, "end", void 0);
class ServicesReportQueryDto {
}
exports.ServicesReportQueryDto = ServicesReportQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Ano de referência. Default: ano corrente.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1970),
    __metadata("design:type", Number)
], ServicesReportQueryDto.prototype, "year", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        maximum: 12,
        description: 'Default: mês corrente.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(12),
    __metadata("design:type", Number)
], ServicesReportQueryDto.prototype, "month", void 0);
//# sourceMappingURL=report.dto.js.map