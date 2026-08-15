import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { analyticsApi, type AnalyticsParams } from '../api/analytics'

export const analyticsKeys = {
  all: ['analytics'] as const,
  view: (params: AnalyticsParams) => ['analytics', params] as const,
}

export function useAnalytics(params: AnalyticsParams) {
  return useQuery({
    queryKey: analyticsKeys.view(params),
    queryFn: () => analyticsApi.get(params),
    // Mantém o painel anterior visível ao trocar de período, em vez de piscar
    // para o estado de carregamento a cada ajuste de filtro.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}
