import { useQuery } from '@tanstack/react-query'

import { hoursBankApi, type MonthlyHoursSummaryParams } from '../api/hours-bank'

export const hoursBankKeys = {
  monthlySummary: (params: MonthlyHoursSummaryParams) =>
    ['hours-bank', 'monthly-summary', params] as const,
}

/**
 * Resumo de horas de um mês (cartão do dashboard do legado).
 *
 * `enabled` é o que permite pedir só quando há mês concreto: com "Todo o
 * período" a consulta não faz sentido e não deve disparar.
 */
export function useMonthlyHoursSummary(params: MonthlyHoursSummaryParams, enabled = true) {
  return useQuery({
    queryKey: hoursBankKeys.monthlySummary(params),
    queryFn: () => hoursBankApi.monthlySummary(params),
    enabled,
    // Mês fechado raramente muda; o mês corrente muda com lançamentos, então o
    // valor fica estável uns minutos e o pull-to-refresh cuida do resto.
    staleTime: 10 * 60 * 1000,
  })
}
