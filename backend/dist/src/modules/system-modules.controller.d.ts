import { CreateSystemModuleDto, ListSystemModulesQueryDto, PaginatedSystemModulesResponse, SystemModuleResponse, UpdateSystemModuleDto } from './dto/system-module.dto';
import { SystemModulesService } from './system-modules.service';
export declare class SystemModulesController {
    private readonly systemModulesService;
    constructor(systemModulesService: SystemModulesService);
    listActive(): Promise<SystemModuleResponse[]>;
    list(query: ListSystemModulesQueryDto): Promise<PaginatedSystemModulesResponse>;
    findOne(id: number): Promise<SystemModuleResponse>;
    create(dto: CreateSystemModuleDto): Promise<SystemModuleResponse>;
    update(id: number, dto: UpdateSystemModuleDto): Promise<SystemModuleResponse>;
    toggle(id: number): Promise<SystemModuleResponse>;
    remove(id: number): Promise<void>;
}
