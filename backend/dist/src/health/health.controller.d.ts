import { HealthService } from './health.service';
export declare class HealthController {
    private readonly healthService;
    constructor(healthService: HealthService);
    live(): import("./health.service").LivenessResult;
    ready(): Promise<import("./health.service").ReadinessResult>;
}
