import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import helmet from 'helmet';

import { resolveCorsOrigin } from './common/http/cors-origin';
import { CORRELATION_ID_HEADER } from './common/observability/request-context';

/**
 * Configuração global compartilhada entre o `main.ts` e o harness de testes.
 *
 * Existe porque o harness reproduzia à mão apenas o prefixo e o `ValidationPipe`
 * — headers de segurança e CORS ficavam de fora. O resultado é que a suíte de
 * integração testava uma aplicação diferente da que roda em produção, e
 * justamente nos aspectos que a Fase 11 introduz. Com um ponto só, o que for
 * acrescentado aqui vale para os dois.
 */
export interface GlobalSetupOptions {
  apiPrefix: string;
  corsOrigins: string[];
  /**
   * Fora de produção, aceita também origens de loopback e rede privada — ver
   * `cors-origin.ts`. Abrir o app por `127.0.0.1` em vez de `localhost` é a
   * mesma máquina, mas outra origem, e o bloqueio aparece como "não foi
   * possível conectar ao servidor".
   */
  allowLocalNetworkOrigins?: boolean;
}

/**
 * Teto do JSON da API. A logo de até 1MB entra em base64 (payload JSON de
 * ~1,4MB); o parser padrão do Nest aceitaria só 100kb e a logo viraria 413
 * antes de o serviço aplicar o seu teto de 1MB (que é um 400). Para o payload
 * real chegar ao controlador, o parser padrão é desligado (main.ts/harness)
 * e um com este limite é registrado aqui.
 */
const JSON_BODY_LIMIT = '2mb';

export function applyGlobalSetup(
  app: INestApplication,
  options: GlobalSetupOptions,
): void {
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

  app.setGlobalPrefix(options.apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.use(
    helmet({
      // A API devolve JSON e PDF — nunca HTML que execute script. Uma CSP
      // restritiva aqui não protegeria nada e quebraria o Swagger, que é HTML
      // servido pela própria aplicação.
      contentSecurityPolicy: false,
      // O frontend é outra origem (Metro na 8081); `same-origin` faria o
      // navegador bloquear o download do PDF gerado pela API.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: resolveCorsOrigin(
      options.corsOrigins,
      options.allowLocalNetworkOrigins ?? false,
    ),
    credentials: true,
    // Sem `exposedHeaders`, o navegador esconde do JavaScript qualquer cabeçalho
    // fora da lista segura — o frontend não leria o correlation ID nem o nome
    // do arquivo do PDF.
    exposedHeaders: [CORRELATION_ID_HEADER, 'Content-Disposition'],
  });
}
