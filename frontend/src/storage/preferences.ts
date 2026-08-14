// Preferências de interface. Diferente da sessão, nada aqui é segredo, então
// AsyncStorage serve em todas as plataformas — SecureStore seria custo sem
// ganho, e no Web ele nem existe.
import AsyncStorage from '@react-native-async-storage/async-storage'

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
