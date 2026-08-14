import { useRouter } from 'expo-router'
import React from 'react'
import { StyleSheet, View } from 'react-native'

import EmptyState from '../src/components/EmptyState'
import { useTheme } from '../src/theme/ThemeContext'

/**
 * Deep links inválidos existem — no Web basta o usuário editar a URL. Sem esta
 * rota o expo-router mostra uma tela de erro de desenvolvimento.
 */
export default function NotFound() {
  const theme = useTheme()
  const router = useRouter()

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <EmptyState
        title="Página não encontrada"
        description="O endereço acessado não existe ou você não tem acesso a ele."
        actionLabel="Voltar ao início"
        onAction={() => router.replace('/')}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
})
