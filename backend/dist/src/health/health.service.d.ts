import { PrismaService } from '../prisma/prisma.service';
export interface LivenessResult {
    status: 'ok';
    uptime: number;
}
export interface ReadinessResult {
    status: 'ok' | 'degraded';
    database: 'up' | 'down';
}
export declare class HealthService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    live(): LivenessResult;
    ready(): Promise<ReadinessResult>;
}
