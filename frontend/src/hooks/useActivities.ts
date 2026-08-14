import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { activitiesApi, type ActivityInput } from '../api/activities'

import { ticketKeys } from './useTickets'

export const activityKeys = {
  list: (ticketId: number) => ['activities', ticketId] as const,
}

export function useActivities(ticketId: number | null) {
  return useQuery({
    queryKey: activityKeys.list(ticketId ?? -1),
    queryFn: () => activitiesApi.list(ticketId as number),
    enabled: ticketId !== null,
  })
}

/**
 * Toda mutação de atividade invalida também o chamado: `activityCount` na
 * listagem e no detalhe fica desatualizado sem isso.
 */
function useActivityInvalidation(ticketId: number) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: activityKeys.list(ticketId) })
    void queryClient.invalidateQueries({ queryKey: ticketKeys.all })
  }
}

export function useCreateActivity(ticketId: number) {
  const invalidate = useActivityInvalidation(ticketId)
  return useMutation({
    mutationFn: (input: ActivityInput) => activitiesApi.create(ticketId, input),
    onSuccess: invalidate,
  })
}

export function useUpdateActivity(ticketId: number) {
  const invalidate = useActivityInvalidation(ticketId)
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ActivityInput }) =>
      activitiesApi.update(ticketId, id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteActivity(ticketId: number) {
  const invalidate = useActivityInvalidation(ticketId)
  return useMutation({
    mutationFn: (id: number) => activitiesApi.remove(ticketId, id),
    onSuccess: invalidate,
  })
}
