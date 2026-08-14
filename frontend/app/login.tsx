import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Card from '../src/components/Card'
import ThemeToggle from '../src/components/ThemeToggle'
import { useTheme } from '../src/theme/ThemeContext'

/**
 * Rota pública de entrada. A Fase 08 entrega apenas o lugar dela na navegação;
 * o formulário, a validação e o tratamento de erro de credencial são a Fase 09.
 */
export default function Login() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 24 }]}
    >
      <View style={[styles.brandMark, { backgroundColor: theme.palette.primary }]}>
        <Text style={[styles.brandInitials, { color: theme.palette.accent }]}>HD</Text>
      </View>

      <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
        Hope Desk
      </Text>

      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Entrar</Text>
        <Text style={[styles.cardBody, { color: theme.textSecondary }]}>
          O formulário de acesso será entregue na Fase 09 da migração.
        </Text>
      </Card>

      <ThemeToggle />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', gap: 16, padding: 24 },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandInitials: { fontSize: 21, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '800' },
  card: { width: '100%', maxWidth: 400 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  cardBody: { marginTop: 6, lineHeight: 20 },
})
