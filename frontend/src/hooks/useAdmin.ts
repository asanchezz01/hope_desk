import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  modulesApi,
  parametersApi,
  paymentsApi,
  usersApi,
  type CreatePaymentInput,
  type CreateUserInput,
  type UpdateParametersInput,
  type UpdateUserInput,
  type UploadLogoInput,
} from '../api/admin'
import type { UserRole } from '../api/client'

import { catalogKeys } from './useCatalog'

export const adminKeys = {
  users: (params: object) => ['admin', 'users', params] as const,
  modules: (params: object) => ['admin', 'modules', params] as const,
  parameters: ['admin', 'parameters'] as const,
  payments: (params: object) => ['admin', 'payments', params] as const,
}

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------

export function useUsers(params: { role?: UserRole; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: adminKeys.users(params),
    queryFn: () => usersApi.list(params),
    placeholderData: keepPreviousData,
  })
}

/**
 * Mexer em usuário invalida também os catálogos: as listas de técnicos e
 * clientes dos formulários de chamado saem daqui.
 */
function useUserInvalidation() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    void queryClient.invalidateQueries({ queryKey: catalogKeys.technicians })
    void queryClient.invalidateQueries({ queryKey: catalogKeys.clients })
  }
}

export function useCreateUser() {
  const invalidate = useUserInvalidation()
  return useMutation({
    mutationFn: (input: CreateUserInput) => usersApi.create(input),
    onSuccess: invalidate,
  })
}

export function useUpdateUser() {
  const invalidate = useUserInvalidation()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateUserInput }) =>
      usersApi.update(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteUser() {
  const invalidate = useUserInvalidation()
  return useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: invalidate,
  })
}

// ---------------------------------------------------------------------------
// Módulos
// ---------------------------------------------------------------------------

export function useModules(params: { isActive?: boolean; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: adminKeys.modules(params),
    queryFn: () => modulesApi.list(params),
    placeholderData: keepPreviousData,
  })
}

/** Desativar um módulo muda a lista de módulos ATIVOS usada na abertura. */
function useModuleInvalidation() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'modules'] })
    void queryClient.invalidateQueries({ queryKey: catalogKeys.modules })
  }
}

export function useCreateModule() {
  const invalidate = useModuleInvalidation()
  return useMutation({
    mutationFn: (input: { name: string; isActive?: boolean }) => modulesApi.create(input),
    onSuccess: invalidate,
  })
}

export function useToggleModule() {
  const invalidate = useModuleInvalidation()
  return useMutation({
    mutationFn: (id: number) => modulesApi.toggle(id),
    onSuccess: invalidate,
  })
}

export function useDeleteModule() {
  const invalidate = useModuleInvalidation()
  return useMutation({
    mutationFn: (id: number) => modulesApi.remove(id),
    onSuccess: invalidate,
  })
}

// ---------------------------------------------------------------------------
// Parâmetros da empresa
// ---------------------------------------------------------------------------

export function useCompanyParameters(enabled = true) {
  return useQuery({
    queryKey: adminKeys.parameters,
    queryFn: parametersApi.get,
    enabled,
  })
}

export function useUpdateCompanyParameters() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateParametersInput) => parametersApi.update(input),
    onSuccess: (updated) => {
      queryClient.setQueryData(adminKeys.parameters, updated)
      // A franquia mensal entra no cálculo do banco de horas exibido no painel.
      void queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}

export function useUploadCompanyLogo() {
  return useMutation({
    mutationFn: (input: UploadLogoInput) => parametersApi.uploadLogo(input),
  })
}

export function useRemoveCompanyLogo() {
  return useMutation({
    mutationFn: () => parametersApi.removeLogo(),
  })
}

// ---------------------------------------------------------------------------
// Pagamentos
// ---------------------------------------------------------------------------

export function usePayments(params: {
  from?: string
  to?: string
  page?: number
  pageSize?: number
}) {
  return useQuery({
    queryKey: adminKeys.payments(params),
    queryFn: () => paymentsApi.list(params),
    placeholderData: keepPreviousData,
  })
}

/** Pagamento abate horas do banco, então o painel precisa ser refeito. */
function usePaymentInvalidation() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
    void queryClient.invalidateQueries({ queryKey: ['analytics'] })
  }
}

export function useCreatePayment() {
  const invalidate = usePaymentInvalidation()
  return useMutation({
    mutationFn: (input: CreatePaymentInput) => paymentsApi.create(input),
    onSuccess: invalidate,
  })
}

export function useDeletePayment() {
  const invalidate = usePaymentInvalidation()
  return useMutation({
    mutationFn: (id: number) => paymentsApi.remove(id),
    onSuccess: invalidate,
  })
}
