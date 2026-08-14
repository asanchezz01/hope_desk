import { Injectable, Logger } from '@nestjs/common';
import { DomainEventMap, DomainEventName } from './domain-events';

export type DomainEventHandler<Name extends DomainEventName> = (
  payload: DomainEventMap[Name],
) => void | Promise<void>;

/**
 * Barramento de eventos em processo, tipado.
 *
 * Implementado à mão em vez de acrescentar `@nestjs/event-emitter`: são ~40
 * linhas, o contrato fica tipado pelo `DomainEventMap`, e as fases seguintes
 * pedem explicitamente para não introduzir dependências sem justificativa.
 *
 * ## Garantia importante
 *
 * `publish` **nunca propaga** exceção de handler. Notificação que falha não pode
 * derrubar a transação de negócio que já foi confirmada — é a mesma regra do
 * `send_email` do legado, que devolve `False` em vez de lançar.
 *
 * Chame `publish` **depois** do commit, nunca dentro da transação.
 */
@Injectable()
export class DomainEventsService {
  private readonly logger = new Logger(DomainEventsService.name);

  private readonly handlers = new Map<
    DomainEventName,
    DomainEventHandler<DomainEventName>[]
  >();

  /**
   * Registra um handler e devolve a função que o remove.
   *
   * Prefira o retorno em vez de `removeAllHandlers`: assinar e cancelar só a
   * própria assinatura evita derrubar handlers de produção por engano — foi
   * exatamente isso que um teste da Fase 05 provocou ao chamar
   * `removeAllHandlers` e desativar em silêncio a notificação de e-mail.
   */
  on<Name extends DomainEventName>(
    event: Name,
    handler: DomainEventHandler<Name>,
  ): () => void {
    const existing = this.handlers.get(event) ?? [];
    const stored = handler as DomainEventHandler<DomainEventName>;
    existing.push(stored);
    this.handlers.set(event, existing);

    return () => {
      const current = this.handlers.get(event);
      if (!current) return;

      const index = current.indexOf(stored);
      if (index >= 0) {
        current.splice(index, 1);
      }
      if (current.length === 0) {
        this.handlers.delete(event);
      }
    };
  }

  /**
   * Remove **todos** os handlers de um evento, inclusive os registrados no
   * boot pela aplicação. Use apenas quando a intenção for justamente essa;
   * para cancelar uma assinatura específica, use o retorno de `on`.
   */
  removeAllHandlers(event: DomainEventName): void {
    this.handlers.delete(event);
  }

  handlerCount(event: DomainEventName): number {
    return this.handlers.get(event)?.length ?? 0;
  }

  /**
   * Dispara os handlers do evento. Erros são registrados e engolidos,
   * individualmente — um handler que falha não impede os outros.
   */
  async publish<Name extends DomainEventName>(
    event: Name,
    payload: DomainEventMap[Name],
  ): Promise<void> {
    const handlers = this.handlers.get(event) ?? [];
    if (handlers.length === 0) {
      // Normal até a Fase 07: os eventos são emitidos antes de haver handlers.
      this.logger.debug(`Evento ${event} publicado sem handlers registrados.`);
      return;
    }

    for (const handler of handlers) {
      try {
        await handler(payload);
      } catch (error) {
        this.logger.error(
          `Handler de ${event} falhou: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }
  }
}
