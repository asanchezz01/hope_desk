import { AuthenticatedUser } from '../auth/auth.types';
import { CreateUserDto, ListUsersQueryDto, PaginatedUsersResponse, UpdateUserDto, UserResponse } from './dto/user.dto';
import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    list(query: ListUsersQueryDto): Promise<PaginatedUsersResponse>;
    listTechnicians(): Promise<UserResponse[]>;
    listClients(): Promise<UserResponse[]>;
    findOne(id: number): Promise<UserResponse>;
    create(actor: AuthenticatedUser, dto: CreateUserDto): Promise<UserResponse>;
    update(actor: AuthenticatedUser, id: number, dto: UpdateUserDto): Promise<UserResponse>;
    remove(actor: AuthenticatedUser, id: number): Promise<void>;
}
