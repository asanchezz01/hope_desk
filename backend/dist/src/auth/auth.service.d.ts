import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './auth.types';
import { AuthUserResponse, ChangePasswordDto, LoginDto, LoginResponse, ResetPasswordDto, TokenPairResponse } from './dto/auth.dto';
import { PasswordService } from './password/password.service';
import { TokenService } from './token.service';
export declare const RESET_TOKEN_MAX_AGE_HOURS = 2;
export declare const FORGOT_PASSWORD_MESSAGE = "Se o e-mail estiver cadastrado, enviaremos as instru\u00E7\u00F5es de troca de senha.";
export interface IssuedResetToken {
    token: string;
    userId: number;
    email: string;
    name: string;
    expiresAt: Date;
}
export declare class AuthService {
    private readonly prisma;
    private readonly passwordService;
    private readonly tokenService;
    private readonly logger;
    constructor(prisma: PrismaService, passwordService: PasswordService, tokenService: TokenService);
    login(dto: LoginDto): Promise<LoginResponse>;
    private rehashPassword;
    refresh(refreshToken: string): Promise<TokenPairResponse>;
    logout(refreshToken: string): Promise<void>;
    logoutAll(userId: number): Promise<number>;
    currentUser(user: AuthenticatedUser): Promise<AuthUserResponse>;
    changePassword(user: AuthenticatedUser, dto: ChangePasswordDto): Promise<void>;
    issueResetToken(email: string): Promise<IssuedResetToken | null>;
    resetPassword(dto: ResetPasswordDto): Promise<void>;
    private assertPasswordConfirmation;
}
export declare function hashResetToken(token: string): string;
interface UserRecord {
    id: number;
    name: string;
    email: string;
    role: string;
    isSuperuser: boolean;
    mustChangePassword: boolean;
}
export declare function toAuthUser(user: UserRecord): AuthUserResponse;
export {};
