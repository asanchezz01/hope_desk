import { useQuery } from '@tanstack/react-query'

import { catalogApi } from '../api/catalog'
import { useAuth } from '../context/AuthProvider'

const CATALOG_STALE_TIME = 5 * 60 * 1000

export const catalogKeys = {
  modules: ['catalog', 'modules'] as const,
  technicians: ['catalog', 'technicians'] as const,
  clients: ['catalog', 'clients'] as const,
}

/** Disponível a qualquer autenticado — o cliente precisa para abrir chamado. */
export function useActiveModules() {
  return useQuery({
    queryKey: catalogKeys.modules,
    queryFn: catalogApi.activeModules,
    staleTime: CATALOG_STALE_TIME,
  })
}

/**
 * O controller de `users` inteiro exige papel de técnico, então pedir esta
 * lista como cliente resulta em 403. O `enabled` evita a requisição inútil e o
 * erro que apareceria na tela sem motivo.
 */
export function useTechnicians() {
  const { user } = useAuth()
  const allowed = user !== null && (user.role === 'technician' || user.isSuperuser)

  return useQuery({
    queryKey: catalogKeys.technicians,
    queryFn: catalogApi.technicians,
    enabled: allowed,
    staleTime: CATALOG_STALE_TIME,
  })
}

/** Mesma restrição de `useTechnicians`. */
export function useClients() {
  const { user } = useAuth()
  const allowed = user !== null && (user.role === 'technician' || user.isSuperuser)

  return useQuery({
    queryKey: catalogKeys.clients,
    queryFn: catalogApi.clients,
    enabled: allowed,
    staleTime: CATALOG_STALE_TIME,
  })
}
