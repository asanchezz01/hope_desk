/**
 * Valores do seletor de período.
 *
 * O seletor é UM controle só, e não um par "ano/mês" ao lado de botões de
 * atalho. É de propósito: com dois controles existe estado impossível — ano
 * 2025, mês março E "últimos 30 dias" marcados ao mesmo tempo —, e alguém tem
 * de decidir qual vence. Um controle só não tem esse problema.
 *
 * Como o `Select` trabalha com números, os três tipos de escolha convivem numa
 * escala só:
 *
 *   > 0   um ano concreto (aí o seletor de mês aparece);
 *   = 0   todo o histórico;
 *   < 0   janela móvel — `-30` é "últimos 30 dias".
 *
 * `LAST_DAYS_CHOICES` espelha `backend/src/common/domain/periods.ts`. Os dois
 * precisam concordar: a API valida a lista e recusa o que não estiver nela.
 */

/** Sentinela de "todo o período". */
export const ALL_PERIODS = 0

export const LAST_DAYS_CHOICES = [30, 60, 90, 120] as const

/** Opções de janela móvel, na ordem em que aparecem no seletor. */
export const LAST_DAYS_OPTIONS = LAST_DAYS_CHOICES.map((days) => ({
  value: -days,
  label: `Últimos ${days} dias`,
}))

/** Quantos dias a escolha representa, ou `undefined` se não for janela móvel. */
export function lastDaysOf(period: number): number | undefined {
  return period < 0 ? -period : undefined
}

/** Verdadeiro quando a escolha não fixa um mês — janela móvel ou todo o período. */
export function hasNoConcreteMonth(period: number): boolean {
  return period <= ALL_PERIODS
}

/**
 * Valida um valor de período vindo de fora (disco, query string).
 *
 * Existe porque o filtro salvo é lido do `AsyncStorage`: um `-45` gravado por
 * uma versão anterior — ou por alguém editando o armazenamento — viraria
 * `lastDays=45`, que a API recusa com 400 logo na abertura da tela.
 */
export function isPeriodValue(value: number): boolean {
  if (!Number.isInteger(value)) return false
  if (value === ALL_PERIODS) return true
  if (value > 0) return value >= 1970
  return (LAST_DAYS_CHOICES as readonly number[]).includes(-value)
}

/**
 * Parâmetros de período para a API, a partir da escolha do seletor.
 *
 * Um lugar só para a regra, porque a lista de chamados e o painel têm de mandar
 * exatamente a mesma coisa — se divergirem, as duas telas mostram recortes
 * diferentes com o mesmo filtro na tela.
 */
export function periodParams(
  period: number,
  month: number
): { lastDays?: number; allPeriods?: true; year?: number; month?: number } {
  const lastDays = lastDaysOf(period)
  if (lastDays) return { lastDays }
  if (period === ALL_PERIODS) return { allPeriods: true }
  // Mês fora de 1..12 é o sentinela de "ano inteiro" do painel: manda só o ano.
  return month >= 1 && month <= 12 ? { year: period, month } : { year: period }
}
