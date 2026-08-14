import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { reportsApi, type ActivityReportParams, type ServicesReportParams } from '../api/reports'
import { saveAndShareFile } from '../download/save-file'

export const reportKeys = {
  activities: (params: ActivityReportParams) => ['reports', 'activities', params] as const,
  services: (params: ServicesReportParams) => ['reports', 'services', params] as const,
}

export function useActivityReport(params: ActivityReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.activities(params),
    queryFn: () => reportsApi.activities(params),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useServicesReport(params: ServicesReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.services(params),
    queryFn: () => reportsApi.services(params),
    enabled,
    placeholderData: keepPreviousData,
  })
}

type PdfSource = 'activities' | 'services'

/**
 * Baixa o PDF e entrega ao sistema.
 *
 * É mutação e não consulta de propósito: baixar um arquivo é um efeito
 * disparado pelo usuário, que não deve ser refeito sozinho ao remontar a tela
 * nem ficar em cache.
 */
export function useReportPdf() {
  return useMutation({
    mutationFn: async ({
      source,
      params,
      fallbackName,
    }: {
      source: PdfSource
      params: ActivityReportParams | ServicesReportParams
      fallbackName: string
    }) => {
      const { blob, filename } =
        source === 'activities'
          ? await reportsApi.activitiesPdf(params as ActivityReportParams)
          : await reportsApi.servicesPdf(params as ServicesReportParams)

      // A API manda o nome no `Content-Disposition`; o fallback cobre um
      // proxy que remova o cabeçalho.
      await saveAndShareFile(blob, filename ?? fallbackName)
    },
  })
}
