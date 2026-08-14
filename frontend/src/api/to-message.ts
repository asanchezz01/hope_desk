import { ApiError } from './client'

/**
 * Mensagem exibível para qualquer erro.
 *
 * As mensagens de `ApiError` já vêm prontas para o usuário — a API responde em
 * português e o cliente junta a lista do `ValidationPipe` numa frase. O que
 * nunca deve vazar para a tela é o texto de um erro inesperado de JavaScript.
 */
export function toMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Não foi possível concluir a solicitação. Tente novamente.'
}

/** `true` quando o erro é falta de conexão, e não recusa do servidor. */
export function isOffline(error: unknown): boolean {
  return error instanceof ApiError && error.isOffline
}
