import { CompanyParametersResponse, PublicCompanyParametersResponse, UpdateCompanyParametersDto } from './dto/parameter.dto';
import { ParametersService } from './parameters.service';
export declare class ParametersController {
    private readonly parametersService;
    constructor(parametersService: ParametersService);
    findPublic(): Promise<PublicCompanyParametersResponse>;
    findAll(): Promise<CompanyParametersResponse>;
    update(dto: UpdateCompanyParametersDto): Promise<CompanyParametersResponse>;
}
