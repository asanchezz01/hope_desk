import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const SESSION_KEY = 'hope-desk.session'

export interface StoredSession {
  accessToken: string
  refreshToken: string
}

export async function readSession(): Promise<StoredSession | null> {
  const value =
    Platform.OS === 'web'
      ? await AsyncStorage.getItem(SESSION_KEY)
      : await SecureStore.getItemAsync(SESSION_KEY)

  if (!value) return null

  try {
    return JSON.parse(value) as StoredSession
  } catch {
    await clearSession()
    return null
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  const value = JSON.stringify(session)
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(SESSION_KEY, value)
    return
  }
  await SecureStore.setItemAsync(SESSION_KEY, value)
}

export async function clearSession(): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(SESSION_KEY)
    return
  }
  await SecureStore.deleteItemAsync(SESSION_KEY)
}
