// Paleta dos gráficos — e o registro de por que ela é o que é.
//
// Duas famílias de cor com regras DIFERENTES convivem no painel:
//
// 1. STATUS (aberto / em andamento / concluído / fechado). São cores de ESTADO,
//    não de identidade arbitrária, e vêm do legado — as mesmas que a API devolve
//    em `statusMeta`. Reutilizá-las para "série 4" de qualquer outro gráfico é
//    proibido: elas significam uma coisa específica.
//
// 2. MAGNITUDE (por módulo, técnico, cliente, tendência de 12 meses). São uma
//    ÚNICA série ordenada por grandeza. A regra aqui é uma hue só para todas as
//    barras. Colorir cada barra de um jeito seria duplo-encoding: o comprimento
//    já carrega a informação, e gastar a cor nela deixa o gráfico sem canal
//    livre — além de sugerir uma identidade que essas categorias não têm.
//
// ## Validação da paleta (`scripts/validate_palette.js` do skill de dataviz)
//
// STATUS no claro — superfície #ffffff, cores canônicas do legado:
//   PASS separação CVD .......... pior par ΔE 20,7 (protan) · 21,4 (tritan)
//   PASS piso de visão normal ... pior par ΔE 29,7
//   PASS piso de croma
//   FAIL banda de luminância .... #ffcc00 (0,865) e #234783 (0,405) fora
//   WARN contraste .............. #ffcc00 a 1,51:1
//
// STATUS no escuro — superfície #1e293b. As canônicas REPROVAM aqui:
//   #234783 fica em 1,60:1 e #d92120 em 2,92:1 contra o card escuro, ou seja,
//   a fatia "fechado" praticamente desaparecia no tema escuro. Por isso o
//   escuro usa degraus mais claros DAS MESMAS hues — vermelho continua
//   vermelho, azul continua azul; muda o degrau, não a identidade:
//     #ef6b63 · #ffcc00 · #22a866 · #6aa9e9
//   PASS separação CVD .......... pior par ΔE 17,5 (deutan) · 6,8 (tritan)
//   PASS piso de visão normal ... pior par ΔE 20,7
//   PASS contraste .............. as 4 acima de 3:1
//   FAIL banda de luminância .... inerente a paleta de status
//
// Duas ressalvas que NÃO são descartáveis:
//
// - O tritan de 6,8 cai na faixa 6–8, que só é legal COM codificação
//   secundária. Ela existe: todo gráfico de status neste painel mostra rótulo
//   e contagem ao lado do segmento, e a tabela de chamados repete tudo em
//   texto. Nenhuma informação depende só da cor.
// - O aviso de contraste no claro obriga o mesmo alívio por rótulo visível.
//
// A banda de luminância é critério de uniformidade de paleta CATEGÓRICA, e
// estas são cores de status herdadas: achatá-las quebraria a paridade com o
// `statusMeta` da API e com a lista de chamados.
//
// MAGNITUDE:
//   #0c4e9a (claro) e #4f93d9 (escuro) — croma e contraste passam no seu modo.
//   `#0c4e9a` no escuro daria 2,13:1 contra a superfície, e por isso não é
//   reaproveitada lá.
import { TICKET_STATUS_META, type TicketStatus } from '../domain/ticket-status'

/**
 * Degraus de status para o tema escuro.
 *
 * Mesmas hues das canônicas, um degrau acima em claridade. Existe porque as
 * canônicas reprovam em contraste contra `#1e293b` — ver a nota acima.
 */
const DARK_STATUS_COLORS: Record<TicketStatus, string> = {
  aberto: '#ef6b63',
  em_andamento: '#ffcc00',
  resolvido: '#22a866',
  fechado: '#6aa9e9',
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
  return (TICKET_STATUS_META as Record<string, { color: string }>)[status]?.color ?? '#6b7280'
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
