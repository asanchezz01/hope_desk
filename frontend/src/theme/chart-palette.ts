// Paleta dos gráficos — e o registro de por que ela é o que é.
//
// Duas famílias de cor com regras DIFERENTES convivem no painel:
//
// 1. STATUS (aberto / em andamento / concluído / fechado). São cores de ESTADO,
//    não de identidade arbitrária, e vêm das escalas semânticas do preset
//    compartilhado da retaguarda NewHope — as mesmas que a API devolve em
//    `statusMeta`. Reutilizá-las para "série 4" de qualquer outro gráfico é
//    proibido: elas significam uma coisa específica.
//
// 2. MAGNITUDE (por módulo, técnico, cliente, tendência de 12 meses). São uma
//    ÚNICA série ordenada por grandeza. A regra aqui é uma hue só para todas as
//    barras. Colorir cada barra de um jeito seria duplo-encoding: o comprimento
//    já carrega a informação, e gastar a cor nela deixa o gráfico sem canal
//    livre — além de sugerir uma identidade que essas categorias não têm.
//
// ## Contraste contra a superfície do cartão
//
// STATUS no claro — superfície #ffffff, os degraus 600/700 das escalas:
//   #b03a3a 5,98:1 · #a2600b 4,98:1 · #0d7f57 5,01:1 · #1f5fe0 5,57:1.
//   Todos acima dos 3:1 exigidos de elemento gráfico. Foi o principal ganho da
//   padronização: o âmbar do produto antigo (#ffcc00) ficava em 1,5:1.
//
// STATUS no escuro — superfície #0c192a. Os degraus do claro NÃO servem aqui
//   (#b03a3a cai para 2,96:1, e a fatia "aberto" some). Por isso o escuro usa o
//   degrau 400 DAS MESMAS hues — vermelho continua vermelho, azul continua
//   azul; muda o degrau, não o significado:
//     #fb7185 6,57:1 · #fbbf24 10,59:1 · #34d399 9,20:1 · #38bdf8 8,25:1.
//
// A banda de luminância de uma paleta CATEGÓRICA não fecha, e não deveria: são
// quatro estados com peso semântico diferente, e achatá-los quebraria a
// paridade com o `statusMeta` da API e com a lista de chamados. A compensação
// obrigatória é a mesma de sempre e não é descartável: **todo gráfico de status
// mostra rótulo e contagem ao lado do segmento**, e a tabela de chamados repete
// tudo em texto. Nenhuma informação depende só da cor — o que também cobre quem
// não distingue vermelho de verde.
//
// MAGNITUDE:
//   #0d7f57 (claro) e #34d399 (escuro) — o verde da marca, no degrau que cada
//   superfície aguenta. `#0d7f57` sobre #0c192a daria 2,7:1, e por isso não é
//   reaproveitado lá.
import { TICKET_STATUS_META, type TicketStatus } from '../domain/ticket-status'

/**
 * Degraus de status para o tema escuro.
 *
 * Mesmas hues do claro, um degrau acima em claridade (o 400 das escalas).
 * Existe porque os degraus do claro reprovam em contraste contra `#0c192a` —
 * ver a nota acima.
 */
const DARK_STATUS_COLORS: Record<TicketStatus, string> = {
  aberto: '#fb7185', // red-400
  em_andamento: '#fbbf24', // amber-400
  resolvido: '#34d399', // green-400
  fechado: '#38bdf8', // blue-400
}

/**
 * Cor de status para desenhar num gráfico, ajustada ao tema.
 *
 * Para a cor CANÔNICA (badge de status, paridade com o backend) use
 * `statusColor` de `domain/ticket-status` — esta função é só para marcas de
 * gráfico, onde o que manda é o contraste contra a superfície do card.
 */
export function statusChartColor(status: string, isDark = false): string {
  if (isDark && status in DARK_STATUS_COLORS) {
    return DARK_STATUS_COLORS[status as TicketStatus]
  }
  return (TICKET_STATUS_META as Record<string, { color: string }>)[status]?.color ?? '#576d84'
}

/** Ordem fixa dos status nos gráficos — nunca reordenada por grandeza. */
export const STATUS_CHART_ORDER: TicketStatus[] = ['aberto', 'em_andamento', 'resolvido', 'fechado']

/**
 * Opacidade de uma marca fora do recorte ativo.
 *
 * O legado somava `"33"` ao hexadecimal. Aqui é opacidade de verdade, no
 * atributo do SVG: o resultado é o mesmo esmaecimento sem inventar uma cor que
 * não está na paleta, e sem quebrar quando a cor vier em `rgb()` da API.
 */
export const DIMMED_OPACITY = 0.22

/** Opacidade da marca conforme o recorte — 1 quando não há filtro na dimensão. */
export function markOpacity(activeValue: string | null, value: string): number {
  if (activeValue === null) return 1
  return activeValue === value ? 1 : DIMMED_OPACITY
}
