import { ConsoleLogger, LogLevel } from '@nestjs/common';

import { getRequestContext } from './request-context';

/**
 * Logger em JSON, uma linha por evento (Fase 11).
 *
 * Nenhuma dependência nova: `pino` ou `winston` trariam ganho de desempenho
 * relevante em volume alto, mas este sistema atende uma operação interna, e o
 * roadmap pede para não acrescentar serviços sem justificar. Se o volume
 * crescer, trocar a implementação daqui é local — nada no resto do código
 * chama o logger de outro jeito.
 *
 * Em desenvolvimento o formato legível do Nest é mantido: JSON no terminal
 * durante o desenvolvimento atrapalha mais do que ajuda.
 */
export class StructuredLogger extends ConsoleLogger {
  constructor(private readonly asJson: boolean) {
    super();
  }

  protected override printMessages(
    messages: unknown[],
    context = '',
    logLevel: LogLevel = 'log',
  ): void {
    if (!this.asJson) {
      super.printMessages(messages, context, logLevel);
      return;
    }

    const requestContext = getRequestContext();

    for (const message of messages) {
      const line = {
        timestamp: new Date().toISOString(),
        level: logLevel,
        context: context || undefined,
        message: typeof message === 'string' ? message : safeSerialize(message),
        correlationId: requestContext?.correlationId,
        userId: requestContext?.userId,
        method: requestContext?.method,
        path: requestContext?.path,
      };

      // `process.stdout` direto: `console.log` acrescentaria formatação e
      // quebraria o "uma linha = um evento" que os coletores esperam.
      process.stdout.write(`${JSON.stringify(line)}\n`);
    }
  }
}

function safeSerialize(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    // Referência circular, BigInt, Proxy — nada disso pode derrubar um log.
    return String(value);
  }
}
