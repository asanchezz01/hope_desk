import { AuthenticatedUser } from '../auth/auth.types';
import { PasswordService } from '../auth/password/password.service';
import { TokenService } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, ListUsersQueryDto, PaginatedUsersResponse, UpdateUserDto, UserResponse } from './dto/user.dto';
export declare class UsersService {
    private readonly prisma;
    private readonly passwordService;
    private readonly tokenService;
    constructor(prisma: PrismaService, passwordService: PasswordService, tokenService: TokenService);
    list(query: ListUsersQueryDto): Promise<PaginatedUsersResponse>;
    findOne(id: number): Promise<UserResponse>;
    create(actor: AuthenticatedUser, dto: CreateUserDto): Promise<UserResponse>;
    update(actor: AuthenticatedUser, id: number, dto: UpdateUserDto): Promise<UserResponse>;
    remove(actor: AuthenticatedUser, id: number): Promise<void>;
    listTechnicians(): Promise<UserResponse[]>;
    listClients(): Promise<UserResponse[]>;
    private assertEmailAvailable;
    private assertNotLastSuperuser;
    private translateUniqueViolation;
}
