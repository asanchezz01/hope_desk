import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError } from '../api/client'
import {
  ticketsApi,
  type CreateTicketInput,
  type ListTicketsParams,
  type Ticket,
  type TicketStatus,
  type UpdateTicketInput,
} from '../api/tickets'

export const ticketKeys = {
  all: ['tickets'] as const,
  list: (params: ListTicketsParams) => ['tickets', 'list', params] as const,
  years: () => ['tickets', 'years'] as const,
  detail: (id: number) => ['tickets', 'detail', id] as const,
}

export function useTicketList(params: ListTicketsParams) {
  return useQuery({
    queryKey: ticketKeys.list(params),
    queryFn: () => ticketsApi.list(params),
    // Manter a página anterior visível durante a troca de filtro evita o
    // "pisca-branco" a cada tecla digitada na busca.
    placeholderData: (previous) => previous,
  })
}

export function useAvailableYears() {
  return useQuery({
    queryKey: ticketKeys.years(),
    queryFn: ticketsApi.availableYears,
    // O seletor de anos muda no máximo uma vez por ano.
    staleTime: 10 * 60 * 1000,
  })
}

export function useTicket(id: number | null) {
  return useQuery({
    queryKey: ticketKeys.detail(id ?? -1),
    queryFn: () => ticketsApi.findOne(id as number),
    enabled: id !== null,
    // 404 é resposta legítima para chamado de outro cliente — insistir não
    // muda nada e só atrasa a mensagem.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && (error.isNotFound || error.isForbidden)) && failureCount < 2,
  })
}

/** Invalida listas e seletor de anos; um chamado novo pode criar um ano novo. */
function useTicketInvalidation() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ticketKeys.all })
  }
}

export function useCreateTicket() {
  const invalidate = useTicketInvalidation()
  return useMutation({
    mutationFn: (input: CreateTicketInput) => ticketsApi.create(input),
    onSuccess: invalidate,
  })
}

export function useUpdateTicket(id: number) {
  const queryClient = useQueryClient()
  const invalidate = useTicketInvalidation()
  return useMutation({
    mutationFn: (input: UpdateTicketInput) => ticketsApi.update(id, input),
    onSuccess: (ticket: Ticket) => {
      queryClient.setQueryData(ticketKeys.detail(id), ticket)
      invalidate()
    },
  })
}

export function useChangeTicketStatus(id: number) {
  const queryClient = useQueryClient()
  const invalidate = useTicketInvalidation()
  return useMutation({
    mutationFn: (status: TicketStatus) => ticketsApi.changeStatus(id, status),
    onSuccess: (ticket: Ticket) => {
      queryClient.setQueryData(ticketKeys.detail(id), ticket)
      invalidate()
    },
  })
}

export function useDeleteTicket() {
  const queryClient = useQueryClient()
  const invalidate = useTicketInvalidation()
  return useMutation({
    mutationFn: (id: number) => ticketsApi.remove(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: ticketKeys.detail(id) })
      invalidate()
    },
  })
}
