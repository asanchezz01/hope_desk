import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError } from '../api/client'
import {
  ticketsApi,
  type CreateTicketInput,
  type ListTicketsParams,
  type Ticket,
  type TicketStatus,
  type UpdateTicketInput,
} from '../api/tickets'
import { statusLabel } from '../domain/ticket-status'

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
    placeholderData: keepPreviousData,
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

/**
 * Mudança de status com atualização otimista e rollback (Fase 11).
 *
 * É a única mutação do sistema que merece isso: o resultado é previsível (o
 * status vira exatamente o que foi escolhido), a tela mostra o valor em vários
 * lugares ao mesmo tempo, e a operação é frequente. Criar e editar chamado, ao
 * contrário, dependem de campos que só o servidor decide — número, timestamps,
 * cliente resolvido —, e adivinhar isso na tela seria mostrar dado falso.
 *
 * O `cancelQueries` não é detalhe: sem ele, um refetch que já estava no ar pode
 * chegar DEPOIS da escrita otimista e repor o status antigo, produzindo um
 * "piscar" que parece falha de gravação.
 */
export function useChangeTicketStatus(id: number) {
  const queryClient = useQueryClient()
  const invalidate = useTicketInvalidation()

  return useMutation<Ticket, unknown, TicketStatus, { previous?: Ticket }>({
    mutationFn: (status: TicketStatus) => ticketsApi.changeStatus(id, status),

    onMutate: async (status: TicketStatus) => {
      await queryClient.cancelQueries({ queryKey: ticketKeys.detail(id) })

      const previous = queryClient.getQueryData<Ticket>(ticketKeys.detail(id))
      if (previous) {
        queryClient.setQueryData<Ticket>(ticketKeys.detail(id), {
          ...previous,
          status,
          // `statusLabel` vem pronto da API; no estado otimista ele é derivado
          // do espelho local, senão o texto continuaria mostrando o status
          // anterior enquanto a cor já teria mudado.
          statusLabel: statusLabel(status),
        })
      }

      // Devolvido ao `onError` — é o retrato para onde voltar.
      return { previous }
    },

    onError: (_error, _status, context) => {
      // Só repõe se havia algo antes: escrever `undefined` marcaria a query
      // como carregada com dado vazio e a tela renderizaria um chamado em branco.
      if (context?.previous) {
        queryClient.setQueryData(ticketKeys.detail(id), context.previous)
      }
    },

    onSuccess: (ticket: Ticket) => {
      queryClient.setQueryData(ticketKeys.detail(id), ticket)
    },

    // Em sucesso e em falha: a listagem mostra o status e precisa refletir o
    // desfecho real, seja ele a mudança confirmada ou o valor de volta.
    onSettled: invalidate,
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
