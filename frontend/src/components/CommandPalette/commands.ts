// Lógica da command palette (Fase 11), separada do componente porque é a parte
// que erra em silêncio: um filtro que ignora acento ou caixa faz a pessoa
// digitar "relatorios" e não achar "Relatórios".

export interface PaletteCommand {
  id: string
  label: string
  /** Texto de apoio exibido à direita; também entra na busca. */
  hint?: string
  href: string
}

/**
 * Remove acentos e caixa para comparar.
 *
 * `normalize` existe no Hermes e no navegador, mas o `catch` fica: um runtime
 * sem ICU lança em vez de devolver a string, e derrubar a busca inteira por
 * causa de um acento seria pior do que comparar sem normalizar.
 */
// Marcas combinantes que a decomposição NFD deixa para trás (U+0300..U+036F).
// Escrita com escapes em vez dos caracteres literais: combinantes soltos no
// código-fonte são invisíveis no editor e somem numa conversão de encoding.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

export function normalizeText(value: string): string {
  try {
    return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim()
  } catch {
    return value.toLowerCase().trim()
  }
}

/**
 * Filtra por subsequência de palavras: cada termo digitado precisa aparecer em
 * algum lugar do comando. Isso faz "novo cham" achar "Novo chamado" sem exigir
 * que a pessoa acerte a ordem — e, diferente de uma busca por substring da
 * frase inteira, não quebra quando ela digita "chamado novo".
 *
 * Consulta vazia devolve tudo: a palette aberta precisa mostrar o que existe,
 * senão vira uma caixa de texto sem pistas.
 */
export function filterCommands(
  commands: readonly PaletteCommand[],
  query: string
): PaletteCommand[] {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return [...commands]

  return commands.filter((command) => {
    const haystack = normalizeText(`${command.label} ${command.hint ?? ''}`)
    return terms.every((term) => haystack.includes(term))
  })
}

/**
 * Mantém o índice destacado dentro da lista, com laço nas pontas.
 *
 * Sem o laço, a seta para baixo trava no último item e a pessoa precisa subir
 * um a um; e sem o piso em zero um `total` zerado (busca sem resultado)
 * produziria `-1`, que renderiza "nenhum item destacado" em vez de nada.
 */
export function moveHighlight(current: number, delta: number, total: number): number {
  if (total <= 0) return 0
  return (current + delta + total) % total
}
