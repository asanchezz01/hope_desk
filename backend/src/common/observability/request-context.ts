import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/**
 * Contexto propagado por requisição (Fase 11).
 *
 * `AsyncLocalStorage` e não um parâmetro passado adiante: o correlation ID
 * precisa aparecer em lugares que não recebem o `Request` — o barramento de
 * eventos em processo (`DomainEventsService`), o `MailerService` e a trilha de
 * auditoria. Publicar um evento é assíncrono e roda depois do commit, então sem
 * armazenamento por contexto o log do handler ficaria órfão do request que o
 * originou, que é justamente quando o correlation ID é útil.
 */
export interface RequestContext {
  /** Identifica a requisição de ponta a ponta, inclusive nos handlers. */
  correlationId: string;
  /** Preenchido depois que o guard autentica; ausente em rota pública. */
  userId?: number;
  method?: string;
  path?: string;
  ip?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Cabeçalho aceito na entrada e devolvido na resposta. */
export const CORRELATION_ID_HEADER = 'x-request-id';

/**
 * Um ID vindo de fora é aceito para permitir rastrear a chamada através de um
 * proxy ou de outro serviço — mas é validado antes de entrar em qualquer log.
 * Sem isso, um cliente poderia injetar quebras de linha e forjar registros
 * (log injection).
 */
const SAFE_CORRELATION_ID = /^[A-Za-z0-9._-]{8,128}$/;

export function normalizeCorrelationId(raw: unknown): string {
  if (typeof raw === 'string' && SAFE_CORRELATION_ID.test(raw)) {
    return raw;
  }
  return randomUUID();
}

/** Executa `callback` com um contexto próprio. */
export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => T,
): T {
  return storage.run(context, callback);
}

/** Contexto atual, ou `undefined` fora de uma requisição (boot, cron, teste). */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

/**
 * Completa o contexto depois que a identidade é conhecida.
 *
 * O guard autentica *depois* do middleware, então o `userId` só pode ser
 * anexado neste segundo momento — o objeto é mutado de propósito, para que os
 * logs emitidos antes e depois compartilhem o mesmo registro.
 */
export function setRequestUser(userId: number): void {
  const context = storage.getStore();
  if (context) context.userId = userId;
}
