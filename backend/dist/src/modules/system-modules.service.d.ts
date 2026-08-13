import { PrismaService } from '../prisma/prisma.service';
import { CreateSystemModuleDto, ListSystemModulesQueryDto, PaginatedSystemModulesResponse, SystemModuleResponse, UpdateSystemModuleDto } from './dto/system-module.dto';
export declare class SystemModulesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(query: ListSystemModulesQueryDto): Promise<PaginatedSystemModulesResponse>;
    listActive(): Promise<SystemModuleResponse[]>;
    findOne(id: number): Promise<SystemModuleResponse>;
    create(dto: CreateSystemModuleDto): Promise<SystemModuleResponse>;
    update(id: number, dto: UpdateSystemModuleDto): Promise<SystemModuleResponse>;
    toggle(id: number): Promise<SystemModuleResponse>;
    remove(id: number): Promise<void>;
    private assertNameAvailable;
    private translateUniqueViolation;
}
