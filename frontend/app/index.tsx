import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import Card from '../src/components/Card'
import EmptyState from '../src/components/EmptyState'
import StatusBadge from '../src/components/StatusBadge'
import { useAuth } from '../src/context/AuthProvider'
import AppShell, { type NavItem } from '../src/layout/AppShell'
import { useBreakpoint } from '../src/layout/useBreakpoint'
import { useTheme } from '../src/theme/ThemeContext'

export default function Home() {
  const theme = useTheme()
  const { user, isTechnician, isSuperuser } = useAuth()
  const { breakpoint } = useBreakpoint()

  // As rotas destes itens chegam nas Fases 09 e 10; o shell já sabe escondê-las
  // por perfil. Visibilidade é conveniência — a API é quem autoriza.
  const navItems: NavItem[] = [
    { href: '/', label: 'Início' },
    { href: '/tickets', label: 'Chamados' },
    { href: '/analytics', label: 'Indicadores', visible: isTechnician || isSuperuser },
    { href: '/admin', label: 'Administração', visible: isSuperuser },
  ]

  return (
    <AppShell title="Hope Desk" navItems={navItems}>
      <Card>
        <Text style={[styles.greeting, { color: theme.textPrimary }]}>
          {user ? `Olá, ${user.name}` : 'Olá'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Acompanhe o atendimento sem perder o contexto.
        </Text>
        <View style={styles.badges}>
          <StatusBadge status={user?.role === 'client' ? 'aberto' : 'em_andamento'} />
          <Text style={[styles.meta, { color: theme.muted }]}>Layout: {breakpoint}</Text>
        </View>
      </Card>

      <EmptyState
        title="Fundação pronta"
        description="Autenticação, chamados e indicadores chegam nas próximas fases da migração."
      />
    </AppShell>
  )
}

const styles = StyleSheet.create({
  greeting: { fontSize: 22, fontWeight: '700' },
  subtitle: { marginTop: 4, fontSize: 15, lineHeight: 21 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  meta: { fontSize: 12 },
})
