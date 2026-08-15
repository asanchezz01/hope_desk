// Listas auxiliares dos formulários de chamado (Fase 09).
//
// Atenção às permissões, que não são uniformes:
//
//   GET /system-modules/active → qualquer autenticado (o cliente precisa dela
//                                para abrir chamado)
//   GET /users/technicians     → o controller inteiro de `users` tem
//   GET /users/clients           `@Roles('technician')`, então CLIENTE RECEBE 403
//
// Por isso as duas últimas só devem ser consultadas por técnico ou superuser.
// Os hooks em `src/hooks/useCatalog.ts` cuidam disso com `enabled`.
import type { ApiUser } from './client'
import { request } from './client'

export interface SystemModuleOption {
  id: number
  name: string
  isActive: boolean
}

export const catalogApi = {
  /** Módulos ativos. Abrir chamado exige módulo ativo; editar, não. */
  activeModules: () => request<SystemModuleOption[]>('/system-modules/active'),

  /** Requer técnico ou superuser. */
  technicians: () => request<ApiUser[]>('/users/technicians'),

  /** Requer técnico ou superuser. */
  clients: () => request<ApiUser[]>('/users/clients'),
}
