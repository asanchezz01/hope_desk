/**
 * Configuração central da aplicação.
 *
 * Regras:
 * - nenhum segredo com valor padrão utilizável em produção;
 * - variáveis obrigatórias falham no boot, não em tempo de request;
 * - a validação é pura e testável (ver configuration.spec.ts).
 */

export type NodeEnv = 'development' | 'test' | 'production';

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  apiPrefix: string;
  logLevel: string;
  corsOrigins: string[];
  appPublicUrl: string;
  /**
   * Regravar o hash Werkzeug em bcrypt no primeiro login válido.
   *
   * Ligado por padrão — é o endurecimento da Fase 02. Precisa ser DESLIGADO
   * enquanto o Flask ainda estiver no ar sobre a mesma base de usuários: o
   * Werkzeug não lê bcrypt, então cada rehash tranca aquele usuário fora do
   * sistema antigo, sem aviso e sem volta. Ver `docs/CUTOVER.md` §6.1.
   */
  passwordRehashEnabled: boolean;
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

export class ConfigValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Configuração inválida:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigValidationError';
  }
}

const NODE_ENVS: NodeEnv[] = ['development', 'test', 'production'];

/** Segredos que jamais devem chegar a produção. */
const FORBIDDEN_IN_PRODUCTION = [
  'change-jwt-secret-in-production-abc123xyz',
  'dev-secret-change-in-production',
  'dev-refresh-secret-change-in-production',
  'troque-por-um-segredo-forte-de-desenvolvimento',
  'troque-por-outro-segredo-forte-de-desenvolvimento',
];

const MIN_SECRET_LENGTH = 16;

function str(env: NodeJS.ProcessEnv, key: string): string {
  return (env[key] ?? '').trim();
}

function bool(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const raw = str(env, key).toLowerCase();
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function int(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  problems: string[],
): number {
  const raw = str(env, key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    problems.push(`${key} deve ser um inteiro positivo (recebido: "${raw}")`);
    return fallback;
  }
  return parsed;
}

/**
 * Constrói e valida a configuração a partir de um ambiente arbitrário.
 * Recebe `env` por parâmetro justamente para permitir teste sem poluir process.env.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const problems: string[] = [];

  const rawNodeEnv = str(env, 'NODE_ENV') || 'development';
  if (!NODE_ENVS.includes(rawNodeEnv as NodeEnv)) {
    problems.push(
      `NODE_ENV deve ser um de ${NODE_ENVS.join(', ')} (recebido: "${rawNodeEnv}")`,
    );
  }
  const nodeEnv = (
    NODE_ENVS.includes(rawNodeEnv as NodeEnv) ? rawNodeEnv : 'development'
  ) as NodeEnv;
  const isProduction = nodeEnv === 'production';

  const databaseUrl = str(env, 'DATABASE_URL');
  if (!databaseUrl) {
    problems.push('DATABASE_URL é obrigatória');
  } else if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    problems.push('DATABASE_URL deve usar o esquema postgresql://');
  }

  const accessSecret = str(env, 'JWT_SECRET');
  const refreshSecret = str(env, 'JWT_REFRESH_SECRET');

  for (const [key, value] of [
    ['JWT_SECRET', accessSecret],
    ['JWT_REFRESH_SECRET', refreshSecret],
  ] as const) {
    if (!value) {
      problems.push(`${key} é obrigatória`);
      continue;
    }
    if (value.length < MIN_SECRET_LENGTH) {
      problems.push(`${key} deve ter ao menos ${MIN_SECRET_LENGTH} caracteres`);
    }
    if (isProduction && FORBIDDEN_IN_PRODUCTION.includes(value)) {
      problems.push(
        `${key} está usando um valor de exemplo e não pode ir para produção`,
      );
    }
  }

  if (accessSecret && refreshSecret && accessSecret === refreshSecret) {
    problems.push('JWT_SECRET e JWT_REFRESH_SECRET devem ser diferentes');
  }

  const port = int(env, 'PORT', 3000, problems);
  const mailPort = int(env, 'MAIL_PORT', 587, problems);

  const mailEnabled = bool(env, 'MAIL_ENABLED', false);
  const mailHost = str(env, 'MAIL_SMTP');
  const mailUser = str(env, 'MAIL_USER');
  const mailPass = str(env, 'MAIL_PASS');
  const mailFrom = str(env, 'MAIL_FROM') || mailUser;

  if (mailEnabled && (!mailHost || !mailUser || !mailPass || !mailFrom)) {
    problems.push(
      'MAIL_ENABLED=true exige MAIL_SMTP, MAIL_USER, MAIL_PASS e MAIL_FROM',
    );
  }

  if (problems.length > 0) {
    throw new ConfigValidationError(problems);
  }

  const corsOrigins = str(env, 'CORS_ORIGIN')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    nodeEnv,
    port,
    apiPrefix: str(env, 'API_PREFIX') || 'api/v1',
    logLevel: str(env, 'LOG_LEVEL') || (isProduction ? 'info' : 'debug'),
    corsOrigins,
    appPublicUrl: str(env, 'APP_PUBLIC_URL') || 'http://localhost:8081',
    passwordRehashEnabled: bool(env, 'PASSWORD_REHASH_ENABLED', true),
    databaseUrl,
    jwt: {
      accessSecret,
      refreshSecret,
      accessExpiresIn: str(env, 'JWT_ACCESS_EXPIRES_IN') || '15m',
      refreshExpiresIn: str(env, 'JWT_REFRESH_EXPIRES_IN') || '7d',
    },
    mail: {
      enabled: mailEnabled,
      host: mailHost,
      port: mailPort,
      user: mailUser,
      pass: mailPass,
      from: mailFrom,
      useTls: bool(env, 'MAIL_USE_TLS', true),
    },
  };
}

/** Namespace usado pelo ConfigModule (`configService.get<AppConfig>('app')`). */
export const APP_CONFIG_NAMESPACE = 'app';

export default () => ({ [APP_CONFIG_NAMESPACE]: loadConfig() });
