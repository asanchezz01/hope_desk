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
exports.CompanyParametersResponse = exports.PublicCompanyParametersResponse = exports.UpdateCompanyParametersDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const trim = ({ value }) => typeof value === 'string' ? value.trim() : value;
class UpdateCompanyParametersDto {
}
exports.UpdateCompanyParametersDto = UpdateCompanyParametersDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Hope Desk' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: 'Informe o nome da empresa.' }),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateCompanyParametersDto.prototype, "companyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Rua Exemplo, 100 — São Paulo/SP' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: 'Informe o endereço da empresa.' }),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], UpdateCompanyParametersDto.prototype, "companyAddress", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'URL http(s) ou caminho relativo do arquivo. Pode ser vazio.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], UpdateCompanyParametersDto.prototype, "companyLogo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Franquia mensal de horas. Aceita vírgula decimal.',
        example: '16',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], UpdateCompanyParametersDto.prototype, "monthlyHoursAllowance", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Data de fechamento do banco de horas, em AAAA-MM-DD.',
        example: '2026-01-01',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'Informe a data de fechamento no formato AAAA-MM-DD.',
    }),
    __metadata("design:type", String)
], UpdateCompanyParametersDto.prototype, "hoursBankClosingDate", void 0);
class PublicCompanyParametersResponse {
}
exports.PublicCompanyParametersResponse = PublicCompanyParametersResponse;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PublicCompanyParametersResponse.prototype, "companyName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PublicCompanyParametersResponse.prototype, "companyAddress", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PublicCompanyParametersResponse.prototype, "companyLogo", void 0);
class CompanyParametersResponse extends PublicCompanyParametersResponse {
}
exports.CompanyParametersResponse = CompanyParametersResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Sempre com 2 casas, como o legado grava.' }),
    __metadata("design:type", String)
], CompanyParametersResponse.prototype, "monthlyHoursAllowance", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'AAAA-MM-DD.' }),
    __metadata("design:type", String)
], CompanyParametersResponse.prototype, "hoursBankClosingDate", void 0);
//# sourceMappingURL=parameter.dto.js.map