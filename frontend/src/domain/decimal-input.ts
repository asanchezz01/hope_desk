// Guarda de entrada para valores monetários e de horas (Fase 10).
//
// ## O problema, medido contra a API real
//
// A API normaliza a entrada com `text.replace(',', '.')` e aceita
// `/^-?\d+(\.\d+)?$/` — o mesmo que o legado faz com
// `float(raw.replace(",", "."))`. Consequência:
//
//     "1500,75"  → 1500.75   ✔ como esperado
//     "1.500"    → 1.5       ✘ o usuário quis R$ 1.500,00 e gravou R$ 1,50
//     "1.234,56" → rejeitado (vira "1.234.56", que não casa com o regex)
//
// O caso do meio é um erro de MIL VEZES em dinheiro, aceito em silêncio. O
// comentário no `decimal.util.ts` do backend afirmava que separador de milhar
// era rejeitado; não era — e mudar a API quebraria a paridade com o Flask, que
// é premissa da operação paralela.
//
// Por isso a defesa fica aqui, na borda de entrada: o formulário recusa a forma
// ambígua e pede o formato sem dúvida. Nada disso relaxa a validação do
// servidor, que continua sendo a autoridade.

/** Parece separador de milhar: `1.500`, `1.234.567`. */
const LOOKS_LIKE_THOUSANDS = /^\d{1,3}(\.\d{3})+$/

export interface DecimalInputCheck {
  ok: boolean
  /** Mensagem pronta para exibir; `null` quando válido. */
  error: string | null
}

/**
 * Valida um valor digitado antes de enviar à API.
 *
 * @param label Nome do campo, usado na mensagem ("o valor", "as horas pagas").
 */
export function validateDecimalInput(raw: string, label: string): DecimalInputCheck {
  const text = raw.trim()

  if (!text) {
    return { ok: false, error: `Informe ${label}.` }
  }

  if (LOOKS_LIKE_THOUSANDS.test(text)) {
    // Aqui está o ganho: em vez de gravar 1,50 achando que gravou 1.500,00, o
    // usuário recebe uma instrução clara.
    return {
      ok: false,
      error:
        'Não use ponto como separador de milhar. Escreva 1500,75 — a vírgula separa os centavos.',
    }
  }

  // Duas vírgulas, ou vírgula e ponto juntos: a API rejeitaria, mas com uma
  // mensagem genérica de "número inválido".
  if ((text.match(/,/g) ?? []).length > 1 || (text.includes('.') && text.includes(','))) {
    return { ok: false, error: 'Formato inválido. Use apenas a vírgula, como em 1500,75.' }
  }

  const normalized = text.replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, error: `Informe ${label} como número, por exemplo 1500,75.` }
  }

  return { ok: true, error: null }
}
