// Paleta dos gráficos (Fase 10) — e o registro de por que ela é o que é.
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
// ## Resultado da validação de paleta
//
// Cores de status (#d92120, #ffcc00, #1f9d55, #234783), claro e escuro:
//   PASS separação CVD .......... pior par ΔE 20,7 (protan) / 21,4 (tritan)
//   PASS piso de visão normal ... pior par ΔE 29,7
//   PASS piso de croma
//   FAIL banda de luminância .... #ffcc00 (0,865) e #234783 (0,405) fora
//   WARN contraste ............... #ffcc00 1,47:1 no claro; #234783 1,91:1 no escuro
//
// As duas checagens que decidem se as cores são DISTINGUÍVEIS passam com folga.
// A banda de luminância é um critério de uniformidade de paletas categóricas, e
// estas são cores de status herdadas — mudá-las quebraria a paridade com o
// legado e com o `statusMeta` da API.
//
// O aviso de contraste NÃO é descartável: ele obriga alívio por rótulo visível.
// Por isso todo gráfico de status neste app mostra rótulo e contagem ao lado do
// segmento, e nenhuma informação depende só da cor.
//
// Magnitude:
//   #0c4e9a (claro) e #4f93d9 (escuro) — TODAS as checagens passam no seu modo.
//   `#0c4e9a` no escuro daria 2,13:1 contra a superfície, e por isso não é
//   reaproveitada lá.
import { TICKET_STATUS_META, type TicketStatus } from '../domain/ticket-status'

/** Cor canônica de um status, igual à que a API devolve em `statusMeta`. */
export function statusChartColor(status: string): string {
  return (TICKET_STATUS_META as Record<string, { color: string }>)[status]?.color ?? '#6b7280'
}

/** Ordem fixa dos status nos gráficos — nunca reordenada por grandeza. */
export const STATUS_CHART_ORDER: TicketStatus[] = ['aberto', 'em_andamento', 'resolvido', 'fechado']
