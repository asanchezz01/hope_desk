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

/**
 * Gate de navegação.
 *
 * O `<Slot />` é renderizado SEMPRE, mesmo enquanto a sessão está sendo lida e
 * mesmo quando há redirecionamento pendente. Não é detalhe de estilo: o
 * expo-router exige que o layout raiz monte um navegador já no primeiro render.
 * Devolver o splash — ou um `<Redirect>` — *no lugar* do `Slot` faz o
 * `<Redirect>` tentar navegar antes de existir navegador, e o resultado é
 *
 *     Attempted to navigate before mounting the Root Layout component
 *
 * com **tela branca** no Web. O `expo export` não pegava isso porque a
 * renderização estática monta cada rota isoladamente, sem passar pelo gate.
 *
 * Por isso o splash virou sobreposição: ele cobre o que o `Slot` renderizou
 * embaixo, em vez de substituí-lo — o que também evita o piscar da tela de
 * login antes de a sessão do disco ser lida.
 */
function RouteGate() {
  const { isLoading, user, mustChangePassword } = useAuth()
  const segments = useSegments()
  const theme = useTheme()

  // Enquanto a sessão não foi lida do disco, redirecionar chutaria: um usuário
  // logado veria a tela de login piscar antes de voltar para dentro.
  const redirect = isLoading
    ? null
    : resolveRedirect({
        isAuthenticated: user !== null,
        mustChangePassword,
        segment: segments[0],
      })

  return (
    <View style={styles.root}>
      <Slot />

      {isLoading && (
        <View
          style={[StyleSheet.absoluteFill, styles.splash, { backgroundColor: theme.background }]}
        >
          <ActivityIndicator accessibilityLabel="Carregando" color={theme.primary} size="large" />
        </View>
      )}

      {redirect && <Redirect href={redirect as never} />}
    </View>
  )
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
  root: { flex: 1 },
  splash: { alignItems: 'center', justifyContent: 'center' },
})
