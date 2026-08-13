import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './auth.types';
export interface IssuedTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export interface UserForToken {
    id: number;
    email: string;
    role: string;
    isSuperuser: boolean;
    mustChangePassword: boolean;
}
export declare class TokenService {
    private readonly jwtService;
    private readonly prisma;
    private readonly config;
    constructor(jwtService: JwtService, prisma: PrismaService, configService: ConfigService);
    issueTokens(user: UserForToken): Promise<IssuedTokens>;
    verifyAccessToken(token: string): Promise<AuthenticatedUser>;
    rotateRefreshToken(token: string): Promise<{
        tokens: IssuedTokens;
        user: UserForToken;
    }>;
    revokeRefreshToken(token: string): Promise<void>;
    revokeAllForUser(userId: number): Promise<number>;
    purgeExpired(now?: Date): Promise<number>;
    private decodeExpiry;
    private decodeJti;
    private accessTokenLifetimeSeconds;
}
