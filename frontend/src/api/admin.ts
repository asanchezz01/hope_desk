// Áreas administrativas (Fase 10).
//
// As permissões NÃO são uniformes, e confundi-las abre ou fecha tela errada:
//
//   usuários   → `@Roles('technician')` na classe — técnico comum ACESSA
//   módulos    → `@RequiresSuperuser()` por método (exceto `/active`)
//   parâmetros → leitura pública a autenticados; `GET /` e `PATCH` só superuser
//   pagamentos → `@RequiresSuperuser()` na CLASSE inteira
//
// Foi exatamente esse ponto que a Fase 03 corrigiu: as três áreas
// administrativas exigem `is_superuser`, não `technician`. Gestão de usuários é
// a exceção.
import type { ApiUser, UserRole } from './client'
import { request } from './client'

function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ---------------------------------------------------------------------------
// Usuários — técnico ou superuser
// ---------------------------------------------------------------------------

export interface CreateUserInput {
  name: string
  email: string
  password: string
  role: UserRole
  /** Só superuser pode conceder. */
  isSuperuser?: boolean
  mustChangePassword?: boolean
}

export interface UpdateUserInput {
  name?: string
  email?: string
  password?: string
  role?: UserRole
  isSuperuser?: boolean
  mustChangePassword?: boolean
}

export const usersApi = {
  list: (params: { role?: UserRole; page?: number; pageSize?: number } = {}) =>
    request<Paginated<ApiUser>>(`/users${toQueryString({ ...params })}`),

  create: (input: CreateUserInput) => request<ApiUser>('/users', { method: 'POST', body: input }),

  update: (id: number, input: UpdateUserInput) =>
    request<ApiUser>(`/users/${id}`, { method: 'PATCH', body: input }),

  /**
   * A API recusa excluir o próprio usuário, o último superuser, e qualquer um
   * que tenha chamados ou atividades ligadas.
   */
  remove: (id: number) => request<void>(`/users/${id}`, { method: 'DELETE' }),
}

// ---------------------------------------------------------------------------
// Módulos — superuser
// ---------------------------------------------------------------------------

export interface SystemModule {
  id: number
  name: string
  isActive: boolean
}

export const modulesApi = {
  list: (params: { isActive?: boolean; page?: number; pageSize?: number } = {}) =>
    request<Paginated<SystemModule>>(`/system-modules${toQueryString({ ...params })}`),

  create: (input: { name: string; isActive?: boolean }) =>
    request<SystemModule>('/system-modules', { method: 'POST', body: input }),

  update: (id: number, input: { name?: string; isActive?: boolean }) =>
    request<SystemModule>(`/system-modules/${id}`, { method: 'PATCH', body: input }),

  toggle: (id: number) => request<SystemModule>(`/system-modules/${id}/toggle`, { method: 'POST' }),

  remove: (id: number) => request<void>(`/system-modules/${id}`, { method: 'DELETE' }),
}

// ---------------------------------------------------------------------------
// Parâmetros da empresa
// ---------------------------------------------------------------------------

export interface PublicCompanyParameters {
  companyName: string
  companyAddress: string
  companyLogo: string
}

export interface CompanyParameters extends PublicCompanyParameters {
  /** String, não número: gravado com 2 casas, como `f"{value:.2f}"` do legado. */
  monthlyHoursAllowance: string
  /** `AAAA-MM-DD`. */
  hoursBankClosingDate: string
}

export interface UpdateParametersInput {
  companyName?: string
  companyAddress?: string
  companyLogo?: string
  /** Aceita vírgula decimal, como o legado. Separador de milhar é rejeitado. */
  monthlyHoursAllowance?: string
  hoursBankClosingDate?: string
}

export const parametersApi = {
  /** Nome, endereço e logo — liberado a qualquer autenticado. */
  publicParameters: () => request<PublicCompanyParameters>('/parameters/public'),

  /** Inclui franquia e data de fechamento; exige superuser. */
  get: () => request<CompanyParameters>('/parameters'),

  update: (input: UpdateParametersInput) =>
    request<CompanyParameters>('/parameters', { method: 'PATCH', body: input }),
}

// ---------------------------------------------------------------------------
// Pagamentos — superuser
// ---------------------------------------------------------------------------

/** `value` é exato e serve para cálculo; `formatted` já vem em pt-BR. */
export interface DecimalView {
  value: string
  formatted: string
}

export interface Payment {
  id: number
  /** `AAAA-MM-DD` — data pura, sem hora e sem fuso. */
  paidAt: string
  amount: DecimalView
  paidHours: DecimalView
  createdAt: string
}

export interface PaymentTotals {
  amount: DecimalView
  paidHours: DecimalView
}

export interface PaginatedPayments extends Paginated<Payment> {
  /** Totais do período filtrado INTEIRO, não apenas da página. */
  totals: PaymentTotals
}

export interface CreatePaymentInput {
  paidAt: string
  /** Aceita vírgula decimal (`"1500,00"`). Separador de milhar é rejeitado. */
  amount: string
  paidHours: string
}

export const paymentsApi = {
  list: (params: { from?: string; to?: string; page?: number; pageSize?: number } = {}) =>
    request<PaginatedPayments>(`/payments${toQueryString({ ...params })}`),

  create: (input: CreatePaymentInput) =>
    request<Payment>('/payments', { method: 'POST', body: input }),

  /** Sem janela temporal, ao contrário de chamados e atividades (§6.4). */
  remove: (id: number) => request<void>(`/payments/${id}`, { method: 'DELETE' }),
}
