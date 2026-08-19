// Moldura das telas públicas de autenticação (Fase 09).
//
// `KeyboardAvoidingView` importa aqui: nos formulários de senha o campo fica na
// metade de baixo da tela e, sem isto, o teclado do iOS o cobre.
import React from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Card from '../components/Card'
import CompanyLogo from '../components/CompanyLogo'
import { useCompanyLogo } from '../hooks/useCompanyLogo'
import { useTheme } from '../theme/ThemeContext'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const logoUrl = useCompanyLogo()

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <CompanyLogo size={60} src={logoUrl} />
        <Text style={[styles.brand, { color: theme.textPrimary }]}>Hope Desk</Text>

        <Card style={styles.card}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
          )}
          <View style={styles.body}>{children}</View>
        </Card>

        {footer && <View style={styles.footer}>{footer}</View>}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  brand: { fontSize: 26, fontWeight: '800' },
  card: { width: '100%', maxWidth: 420, marginTop: 8 },
  title: { fontSize: 19, fontWeight: '700' },
  subtitle: { marginTop: 6, lineHeight: 20 },
  body: { marginTop: 16 },
  footer: { width: '100%', maxWidth: 420, alignItems: 'center', gap: 8 },
})
