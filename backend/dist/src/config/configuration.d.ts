/// <reference types="node" />
export type NodeEnv = 'development' | 'test' | 'production';
export interface AppConfig {
    nodeEnv: NodeEnv;
    port: number;
    apiPrefix: string;
    logLevel: string;
    corsOrigins: string[];
    appPublicUrl: string;
    databaseUrl: string;
    jwt: {
        accessSecret: string;
        refreshSecret: string;
        accessExpiresIn: string;
        refreshExpiresIn: string;
    };
    mail: {
        enabled: boolean;
        host: string;
        port: number;
        user: string;
        pass: string;
        from: string;
        useTls: boolean;
    };
}
export declare class ConfigValidationError extends Error {
    readonly problems: string[];
    constructor(problems: string[]);
}
export declare function loadConfig(env?: NodeJS.ProcessEnv): AppConfig;
export declare const APP_CONFIG_NAMESPACE = "app";
declare const _default: () => {
    app: AppConfig;
};
export default _default;
