import path from 'node:path';

import { ConfigValidationError, loadConfig } from './configuration';

const VALID_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/hopedesk',
  JWT_SECRET: 'a-development-access-secret',
  JWT_REFRESH_SECRET: 'a-development-refresh-secret',
};

describe('loadConfig', () => {
  it('carrega a configuração mínima válida com defaults previsíveis', () => {
    const config = loadConfig(VALID_ENV);

    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(3000);
    expect(config.apiPrefix).toBe('api/v1');
    expect(config.jwt.accessExpiresIn).toBe('15m');
    expect(config.jwt.refreshExpiresIn).toBe('7d');
    expect(config.mail.enabled).toBe(false);
    expect(config.corsOrigins).toEqual([]);
    expect(config.logoDir).toMatch(/media[\\/]logo$/);
  });

  it('permite sobrescrever a pasta da logo via LOGO_DIR', () => {
    const config = loadConfig({ ...VALID_ENV, LOGO_DIR: '/custom/logo-folder' });
    expect(config.logoDir).toBe(path.resolve('/custom/logo-folder'));
  });

  it('exige DATABASE_URL', () => {
    expect(() => loadConfig({ ...VALID_ENV, DATABASE_URL: '' })).toThrow(
      ConfigValidationError,
    );
  });

  it('rejeita DATABASE_URL que não seja postgres', () => {
    expect(() =>
      loadConfig({ ...VALID_ENV, DATABASE_URL: 'mysql://root@localhost/hopedesk' }),
    ).toThrow(/postgresql/);
  });

  it('exige os dois segredos de JWT', () => {
    expect(() => loadConfig({ ...VALID_ENV, JWT_SECRET: '' })).toThrow(
      /JWT_SECRET é obrigatória/,
    );
    expect(() => loadConfig({ ...VALID_ENV, JWT_REFRESH_SECRET: '' })).toThrow(
      /JWT_REFRESH_SECRET é obrigatória/,
    );
  });

  it('rejeita segredos curtos', () => {
    expect(() => loadConfig({ ...VALID_ENV, JWT_SECRET: 'curto' })).toThrow(
      /ao menos 16 caracteres/,
    );
  });

  it('rejeita segredos de acesso e refresh iguais', () => {
    expect(() =>
      loadConfig({
        ...VALID_ENV,
        JWT_SECRET: 'mesmo-segredo-para-os-dois',
        JWT_REFRESH_SECRET: 'mesmo-segredo-para-os-dois',
      }),
    ).toThrow(/devem ser diferentes/);
  });

  it('bloqueia segredos de exemplo em produção', () => {
    expect(() =>
      loadConfig({
        ...VALID_ENV,
        NODE_ENV: 'production',
        JWT_SECRET: 'dev-secret-change-in-production',
        JWT_REFRESH_SECRET: 'dev-refresh-secret-change-in-production',
      }),
    ).toThrow(/valor de exemplo/);
  });

  it('aceita segredos próprios em produção', () => {
    const config = loadConfig({
      ...VALID_ENV,
      NODE_ENV: 'production',
      JWT_SECRET: 'segredo-de-producao-forte-1',
      JWT_REFRESH_SECRET: 'segredo-de-producao-forte-2',
    });
    expect(config.nodeEnv).toBe('production');
    expect(config.logLevel).toBe('info');
  });

  it('rejeita NODE_ENV desconhecido', () => {
    expect(() => loadConfig({ ...VALID_ENV, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV deve ser um de/,
    );
  });

  it('rejeita PORT não numérica', () => {
    expect(() => loadConfig({ ...VALID_ENV, PORT: 'abc' })).toThrow(/inteiro positivo/);
  });

  it('exige SMTP completo quando MAIL_ENABLED=true', () => {
    expect(() =>
      loadConfig({ ...VALID_ENV, MAIL_ENABLED: 'true', MAIL_SMTP: 'smtp.example.com' }),
    ).toThrow(/MAIL_ENABLED=true exige/);
  });

  it('aceita SMTP completo quando habilitado', () => {
    const config = loadConfig({
      ...VALID_ENV,
      MAIL_ENABLED: 'true',
      MAIL_SMTP: 'smtp.example.com',
      MAIL_USER: 'bot@example.com',
      MAIL_PASS: 'segredo',
    });
    expect(config.mail.enabled).toBe(true);
    // MAIL_FROM cai para MAIL_USER quando ausente, como no legado.
    expect(config.mail.from).toBe('bot@example.com');
    expect(config.mail.useTls).toBe(true);
  });

  it('divide CORS_ORIGIN por vírgula', () => {
    const config = loadConfig({
      ...VALID_ENV,
      CORS_ORIGIN: 'http://localhost:8081, https://app.hope.com ,',
    });
    expect(config.corsOrigins).toEqual([
      'http://localhost:8081',
      'https://app.hope.com',
    ]);
  });

  it('acumula todos os problemas em um único erro', () => {
    try {
      loadConfig({ NODE_ENV: 'development' });
      fail('deveria ter lançado');
    } catch (error) {
      const validationError = error as ConfigValidationError;
      expect(validationError).toBeInstanceOf(ConfigValidationError);
      expect(validationError.problems.length).toBeGreaterThanOrEqual(3);
    }
  });
});
