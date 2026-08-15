import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import {
  CORRELATION_ID_HEADER,
  RequestContext,
  normalizeCorrelationId,
  runWithRequestContext,
} from './request-context';

/**
 * Abre o contexto da requisição, devolve o correlation ID ao cliente e registra
 * uma linha por requisição concluída.
 *
 * É middleware, e não interceptor, para rodar **antes** dos guards: uma
 * requisição recusada com 401 ou 429 é justamente a que mais interessa
 * rastrear, e um interceptor global não veria essas.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const correlationId = normalizeCorrelationId(
      request.headers[CORRELATION_ID_HEADER],
    );

    // Devolvido sempre: é assim que o suporte liga o relato do usuário à linha
    // de log correspondente.
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    const context: RequestContext = {
      correlationId,
      method: request.method,
      path: request.originalUrl ?? request.url,
      ip: request.ip,
    };

    const startedAt = process.hrtime.bigint();

    // `finish` e não `close`: só interessa a resposta que saiu inteira. O
    // handler é registrado antes do `next()` para cobrir também a requisição
    // que morre num guard.
    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      // Reentra no contexto de propósito. O handler de `finish` roda fora do
      // escopo assíncrono original, e sem isto a linha sairia sem correlation
      // ID nem usuário — justamente os dois campos que a tornam útil. O objeto
      // é o mesmo que o guard mutou, então o `userId` já está preenchido.
      runWithRequestContext(context, () => {
        this.logger.log(
          `${context.method} ${context.path} ${response.statusCode} ${durationMs.toFixed(1)}ms`,
        );
      });
    });

    runWithRequestContext(context, () => next());
  }
}
