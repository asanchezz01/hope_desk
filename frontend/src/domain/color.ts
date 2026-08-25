/**
 * Cor hexadecimal de 6 dígitos — o formato que a API valida e que o
 * `<input type="color">` do navegador fala.
 *
 * Três dígitos (`#abc`) e canal alfa (`#aabbccdd`) ficam de fora de propósito:
 * o seletor nativo não os produz nem os aceita de volta, e o PDF precisa de uma
 * cor opaca. Aceitar aqui o que não volta de lá só criaria um valor que a tela
 * mostra e o navegador ignora.
 */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value.trim())
}

/**
 * Normaliza o que a pessoa digita no campo de cor.
 *
 * Garante um `#` único na frente, joga fora o que não for dígito hexadecimal e
 * corta em seis. Digitar `0D7F57`, `#0d7f57` ou colar `rgb`-lixo com letras
 * válidas converge para a mesma coisa — sem bloquear a digitação no meio, que
 * é o erro comum de máscara: recusar `#0d` porque ainda não tem seis dígitos
 * deixaria o campo impossível de preencher letra a letra.
 */
export function normalizeHexInput(raw: string): string {
  const digits = raw.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
  return `#${digits}`
}

/** A cor, se estiver completa; senão o valor de reserva. Nunca devolve inválido. */
export function hexOr(value: string, fallback: string): string {
  return isHexColor(value) ? value.trim() : fallback
}
