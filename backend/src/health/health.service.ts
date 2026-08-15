import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LivenessResult {
  status: 'ok';
  uptime: number;
}

export interface ReadinessResult {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  live(): LivenessResult {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }

  async ready(): Promise<ReadinessResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch (error) {
      this.logger.error('Readiness falhou ao consultar o banco.', error as Error);
      return { status: 'degraded', database: 'down' };
    }
  }
}
