/**
 * Atualização otimista com rollback (Fase 11).
 *
 * O risco do otimismo é a falha silenciosa: a tela mostra "Concluído", a API
 * recusa, e a pessoa sai acreditando que gravou. Estes testes travam as duas
 * metades — o valor aparece antes da resposta, e volta ao anterior quando a
 * resposta é uma recusa.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'
import React from 'react'

import { ApiError } from '../api/client'
import { ticketsApi, type Ticket } from '../api/tickets'

import { ticketKeys, useChangeTicketStatus } from './useTickets'

jest.mock('../api/tickets', () => {
  const actual = jest.requireActual('../api/tickets')
  return {
    ...actual,
    ticketsApi: { ...actual.ticketsApi, changeStatus: jest.fn() },
  }
})

const changeStatus = ticketsApi.changeStatus as jest.MockedFunction<typeof ticketsApi.changeStatus>

const TICKET: Ticket = {
  id: 7,
  title: 'Impressora sem toner',
  description: 'Não imprime',
  status: 'aberto',
  statusLabel: 'Em aberto',
  createdAt: '2026-08-14T12:00:00.000Z',
  client: { id: 1, name: 'Cliente', email: 'cliente@example.com' },
  technician: null,
  systemModule: null,
  activityCount: 0,
}

/**
 * Clientes criados no teste, para serem limpos no fim.
 *
 * Um `QueryClient` deixa temporizadores de coleta pendurados (`gcTime` padrão de
 * 5 minutos). Sem o `clear()`, o Jest termina a suíte e avisa que um worker não
 * encerrou sozinho — ruído que esconderia um vazamento de verdade mais tarde.
 */
const clients: QueryClient[] = []

function createClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      // Repetição desligada: o que está sob teste é o rollback, e uma segunda
      // tentativa deixaria o teste dependente de temporização.
      //
      queries: { retry: false },
      // `gcTime: 0` nas MUTAÇÕES não é cosmético: com o padrão de 5 minutos,
      // cada mutação deixa um `setTimeout` de coleta agendado que o `clear()`
      // não cancela, e o processo do Jest fica pendurado depois que a suíte
      // termina ("Jest did not exit one second after the test run").
      //
      // Nas QUERIES o mesmo valor quebraria os testes: sem observador, o
      // chamado semeado com `setQueryData` seria coletado antes de a mutação
      // ler o estado anterior, e o rollback não teria para onde voltar.
      mutations: { retry: false, gcTime: 0 },
    },
  })
  clients.push(client)
  return client
}

function setup() {
  const queryClient = createClient()
  queryClient.setQueryData(ticketKeys.detail(TICKET.id), TICKET)

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  const { result, unmount } = renderHook(() => useChangeTicketStatus(TICKET.id), { wrapper })
  mounted.push(unmount)
  return { queryClient, result }
}

/** Desmontagens pendentes — ver o `afterEach`. */
const mounted: (() => void)[] = []

function cached(queryClient: QueryClient): Ticket | undefined {
  return queryClient.getQueryData<Ticket>(ticketKeys.detail(TICKET.id))
}

beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  // Desmontar antes de limpar: um observer ainda montado reagiria ao cache
  // sendo esvaziado e agendaria trabalho depois do fim do teste.
  for (const unmount of mounted.splice(0)) unmount()
  for (const client of clients.splice(0)) client.clear()
})

describe('useChangeTicketStatus', () => {
  it('mostra o status novo antes da resposta da API', async () => {
    // A promise só resolve quando este teste mandar: é o intervalo em que o
    // valor otimista precisa estar visível.
    let concluir: (ticket: Ticket) => void = () => undefined
    changeStatus.mockImplementation(
      () =>
        new Promise<Ticket>((resolve) => {
          concluir = resolve
        })
    )

    const { queryClient, result } = setup()

    result.current.mutate('resolvido')

    await waitFor(() => expect(cached(queryClient)?.status).toBe('resolvido'))
    // O rótulo acompanha o status, senão a tela mostraria cor nova com texto velho.
    expect(cached(queryClient)?.statusLabel).toBe('Concluído')

    concluir({ ...TICKET, status: 'resolvido', statusLabel: 'Concluído' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('desfaz a mudança quando a API recusa', async () => {
    changeStatus.mockRejectedValue(new ApiError('Sem permissão', 403))

    const { queryClient, result } = setup()

    result.current.mutate('fechado')

    await waitFor(() => expect(result.current.isError).toBe(true))

    const restored = cached(queryClient)
    expect(restored?.status).toBe('aberto')
    expect(restored?.statusLabel).toBe('Em aberto')
  })

  it('substitui o valor otimista pelo que a API devolveu', async () => {
    // A API é a palavra final: se ela devolver algo diferente do previsto — um
    // contador de atividades atualizado, por exemplo —, é o valor dela que vale.
    changeStatus.mockResolvedValue({
      ...TICKET,
      status: 'resolvido',
      statusLabel: 'Concluído',
      activityCount: 3,
    })

    const { queryClient, result } = setup()

    result.current.mutate('resolvido')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(cached(queryClient)?.activityCount).toBe(3)
  })

  it('não cria um chamado vazio no cache quando não havia nada guardado', async () => {
    // Sem a guarda do `onError`, o rollback escreveria `undefined` e a query
    // passaria a "carregada com dado vazio" — a tela renderizaria em branco.
    changeStatus.mockRejectedValue(new ApiError('Sem permissão', 403))

    const queryClient = createClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result, unmount } = renderHook(() => useChangeTicketStatus(TICKET.id), { wrapper })
    mounted.push(unmount)

    result.current.mutate('fechado')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(queryClient.getQueryState(ticketKeys.detail(TICKET.id))).toBeUndefined()
  })
})
