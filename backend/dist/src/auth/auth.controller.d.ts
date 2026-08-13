import { DomainEventsService } from '../common/events/domain-events.service';
import { AuthenticatedUser } from './auth.types';
import { AuthService } from './auth.service';
import { AuthUserResponse, ChangePasswordDto, ForgotPasswordDto, LoginDto, LoginResponse, MessageResponse, RefreshTokenDto, ResetPasswordDto, TokenPairResponse } from './dto/auth.dto';
export declare class AuthController {
    private readonly authService;
    private readonly events;
    private readonly logger;
    constructor(authService: AuthService, events: DomainEventsService);
    login(dto: LoginDto): Promise<LoginResponse>;
    refresh(dto: RefreshTokenDto): Promise<TokenPairResponse>;
    logout(dto: RefreshTokenDto): Promise<MessageResponse>;
    logoutAll(user: AuthenticatedUser): Promise<MessageResponse>;
    me(user: AuthenticatedUser): Promise<AuthUserResponse>;
    changePassword(user: AuthenticatedUser, dto: ChangePasswordDto): Promise<MessageResponse>;
    forgotPassword(dto: ForgotPasswordDto): Promise<MessageResponse>;
    resetPassword(dto: ResetPasswordDto): Promise<MessageResponse>;
}
