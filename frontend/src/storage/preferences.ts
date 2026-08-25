// Preferências de interface. Diferente da sessão, nada aqui é segredo, então
// AsyncStorage serve em todas as plataformas — SecureStore seria custo sem
// ganho, e no Web ele nem existe.
import AsyncStorage from '@react-native-async-storage/async-storage'

import { isPeriodValue } from '../domain/periods'

const THEME_MODE_KEY = 'hope-desk.theme-mode'

export type StoredThemeMode = 'light' | 'dark' | 'system'

function isThemeMode(value: unknown): value is StoredThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export async function readThemeMode(): Promise<StoredThemeMode | null> {
  try {
    const value = await AsyncStorage.getItem(THEME_MODE_KEY)
    return isThemeMode(value) ? value : null
  } catch {
    // Preferência de tema não vale derrubar a aplicação: cai no padrão.
    return null
  }
}

export async function saveThemeMode(mode: StoredThemeMode): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_MODE_KEY, mode)
  } catch {
    // idem
  }
}

// ---------------------------------------------------------------------------
// Filtros salvos da listagem de chamados (Fase 11)
// ---------------------------------------------------------------------------

const TICKET_FILTERS_KEY = 'hope-desk.ticket-filters'

/**
 * O termo de BUSCA não é salvo de propósito. Reabrir a aplicação e encontrar a
 * lista filtrada por um texto digitado dias atrás parece defeito — a pessoa vê
 * "nenhum chamado encontrado" sem entender por quê. Período e situação são
 * escolhas de contexto de trabalho, que é o que vale a pena preservar.
 */
export interface StoredTicketFilters {
  /** Valor do seletor de período: ano, `0` (todo o histórico) ou negativo
   *  (janela móvel). Ver `domain/periods.ts`. */
  year: number
  month: number
  status: string
}

/**
 * Valida na leitura. O que está em disco foi escrito por uma versão anterior do
 * aplicativo e pode não ter os campos de hoje — confiar nele levaria um `month`
 * indefinido direto para a query da API, que responderia 400 na primeira
 * abertura depois da atualização.
 */
export function parseTicketFilters(raw: string | null): StoredTicketFilters | null {
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (parsed === null || typeof parsed !== 'object') return null
  const { year, month, status } = parsed as Record<string, unknown>

  // `isPeriodValue` recusa uma janela móvel que não existe mais (um `-45`
  // gravado por outra versão viraria `lastDays=45`, e a API responde 400).
  if (typeof year !== 'number' || !isPeriodValue(year)) return null
  if (typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > 12) return null
  if (typeof status !== 'string' || status.length === 0) return null

  return { year, month, status }
}

export async function readTicketFilters(): Promise<StoredTicketFilters | null> {
  try {
    return parseTicketFilters(await AsyncStorage.getItem(TICKET_FILTERS_KEY))
  } catch {
    return null
  }
}

export async function saveTicketFilters(filters: StoredTicketFilters): Promise<void> {
  try {
    await AsyncStorage.setItem(TICKET_FILTERS_KEY, JSON.stringify(filters))
  } catch {
    // Preferência de filtro não vale interromper a navegação.
  }
}

export async function clearTicketFilters(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TICKET_FILTERS_KEY)
  } catch {
    // idem
  }
}
