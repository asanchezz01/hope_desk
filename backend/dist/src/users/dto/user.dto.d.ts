import { UserRole } from '../../common/domain/legacy-enums';
export declare class CreateUserDto {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    isSuperuser?: boolean;
    mustChangePassword?: boolean;
}
export declare class UpdateUserDto {
    name?: string;
    email?: string;
    role?: UserRole;
    isSuperuser?: boolean;
    mustChangePassword?: boolean;
    password?: string;
}
export declare class ListUsersQueryDto {
    role?: UserRole;
    search?: string;
    page?: number;
    pageSize?: number;
}
export declare class UserResponse {
    id: number;
    name: string;
    email: string;
    role: string;
    isSuperuser: boolean;
    mustChangePassword: boolean;
}
export declare class PaginatedUsersResponse {
    items: UserResponse[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
