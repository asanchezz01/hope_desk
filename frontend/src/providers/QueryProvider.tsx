import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useState } from 'react'

import { ApiError } from '../api/client'

/**
 * Repetir automaticamente só faz sentido para falha de transporte ou erro do
 * servidor. Uma recusa 4xx é determinística: 401, 403, 404 e 400 devolveriam
 * exatamente o mesmo na segunda tentativa, e o **429 fica pior** — cada repetição
 * conta contra o mesmo limite que acabou de ser estourado (Fase 11).
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  return true
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: shouldRetryQuery, staleTime: 30_000, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      })
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
