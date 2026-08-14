import { Redirect, Slot, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import React from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import ErrorBoundary from '../src/components/ErrorBoundary'
import { ToastProvider } from '../src/components/Toast'
import { AuthProvider, useAuth } from '../src/context/AuthProvider'
import { resolveRedirect } from '../src/navigation/route-gate'
import { QueryProvider } from '../src/providers/QueryProvider'
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext'

function RouteGate() {
  const { isLoading, user, mustChangePassword } = useAuth()
  const segments = useSegments()
  const theme = useTheme()

  // Enquanto a sessão não foi lida do disco, redirecionar chutaria: um usuário
  // logado veria a tela de login piscar antes de voltar para dentro.
  if (isLoading) {
    return (
      <View style={[styles.splash, { backgroundColor: theme.background }]}>
        <ActivityIndicator accessibilityLabel="Carregando" color={theme.primary} size="large" />
      </View>
    )
  }

  const redirect = resolveRedirect({
    isAuthenticated: user !== null,
    mustChangePassword,
    segment: segments[0],
  })

  if (redirect) return <Redirect href={redirect as never} />
  return <Slot />
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <ToastProvider>
                <RouteGate />
                <StatusBar style="auto" />
              </ToastProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  )
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
