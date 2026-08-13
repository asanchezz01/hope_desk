export declare const PASSWORD_MIN_LENGTH = 6;
export declare const PASSWORD_MAX_LENGTH = 128;
export declare class LoginDto {
    email: string;
    password: string;
}
export declare class RefreshTokenDto {
    refreshToken: string;
}
export declare class ForgotPasswordDto {
    email: string;
}
export declare class ResetPasswordDto {
    token: string;
    password: string;
    confirmation: string;
}
export declare class ChangePasswordDto {
    currentPassword: string;
    password: string;
    confirmation: string;
}
export declare class AuthUserResponse {
    id: number;
    name: string;
    email: string;
    role: string;
    isSuperuser: boolean;
    mustChangePassword: boolean;
}
export declare class TokenPairResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
}
export declare class LoginResponse extends TokenPairResponse {
    user: AuthUserResponse;
}
export declare class MessageResponse {
    message: string;
}
