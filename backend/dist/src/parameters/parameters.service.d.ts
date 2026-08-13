import { SystemParameterKey } from '../common/domain/legacy-enums';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyParametersResponse, PublicCompanyParametersResponse, UpdateCompanyParametersDto } from './dto/parameter.dto';
export declare class ParametersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    get(key: SystemParameterKey): Promise<string>;
    getMany(keys: SystemParameterKey[]): Promise<Record<SystemParameterKey, string>>;
    ensureDefaults(): Promise<void>;
    findPublic(): Promise<PublicCompanyParametersResponse>;
    findAll(): Promise<CompanyParametersResponse>;
    update(dto: UpdateCompanyParametersDto): Promise<CompanyParametersResponse>;
}
export declare function normalizeHoursAllowance(raw: string): string;
export declare function normalizeClosingDate(raw: string): string;
