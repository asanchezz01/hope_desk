import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '../src/components/Button'
import Card from '../src/components/Card'
import { useAuth } from '../src/context/AuthProvider'
import { useTheme } from '../src/theme/ThemeContext'

/**
 * Destino obrigatório enquanto a API sinaliza `mustChangePassword`. É a única
 * rota autenticada que o gate deixa passar nesse estado — por isso ela existe
 * já na Fase 08, mesmo com o formulário só chegando na Fase 09.
 */
export default function ChangePassword() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { signOut, mustChangePassword } = useAuth()

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 24 }]}
    >
      <Card style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
          {mustChangePassword ? 'Defina uma nova senha' : 'Trocar senha'}
        </Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          {mustChangePassword
            ? 'Sua conta exige a troca da senha antes de acessar o sistema.'
            : 'Você pode alterar sua senha a qualquer momento.'}
        </Text>
        <Text style={[styles.note, { color: theme.muted }]}>
          O formulário será entregue na Fase 09 da migração.
        </Text>
        <View style={styles.actions}>
          <Button title="Sair" variant="outline" onPress={() => void signOut()} />
        </View>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420 },
  title: { fontSize: 20, fontWeight: '700' },
  body: { marginTop: 6, lineHeight: 20 },
  note: { marginTop: 10, fontSize: 12 },
  actions: { marginTop: 16, flexDirection: 'row', justifyContent: 'flex-end' },
})
