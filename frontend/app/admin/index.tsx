import { useRouter } from 'expo-router'
import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import Card from '../../src/components/Card'
import EmptyState from '../../src/components/EmptyState'
import { useAuth } from '../../src/context/AuthProvider'
import AppShell from '../../src/layout/AppShell'
import { navItemsFor } from '../../src/layout/nav-items'
import { useTheme } from '../../src/theme/ThemeContext'

interface AdminArea {
  href: string
  title: string
  description: string
  superuserOnly: boolean
}

/**
 * As permissões NÃO são uniformes, e foi justamente aqui que a Fase 03 achou um
 * erro: as três áreas administrativas exigem `is_superuser`, não `technician`.
 * Gestão de usuários é a exceção — usa `@Roles('technician')`.
 */
const AREAS: AdminArea[] = [
  {
    href: '/admin/users',
    title: 'Usuários',
    description: 'Cadastro, perfil e redefinição de acesso.',
    superuserOnly: false,
  },
  {
    href: '/admin/modules',
    title: 'Módulos do sistema',
    description: 'Módulos disponíveis na abertura de chamados.',
    superuserOnly: true,
  },
  {
    href: '/admin/parameters',
    title: 'Parâmetros da empresa',
    description: 'Dados do cabeçalho dos relatórios, franquia e fechamento.',
    superuserOnly: true,
  },
  {
    href: '/admin/payments',
    title: 'Pagamentos',
    description: 'Horas pagas que abatem o banco de horas.',
    superuserOnly: true,
  },
]

export default function AdminHome() {
  const theme = useTheme()
  const router = useRouter()
  const { user, isSuperuser, isTechnician } = useAuth()

  const areas = AREAS.filter((area) =>
    area.superuserOnly ? isSuperuser : isTechnician || isSuperuser
  )

  return (
    <AppShell title="Administração" navItems={navItemsFor(user)}>
      {areas.length === 0 ? (
        <Card>
          <EmptyState
            title="Sem permissão"
            description="Esta área é restrita à equipe técnica."
            actionLabel="Ver chamados"
            onAction={() => router.replace('/')}
          />
        </Card>
      ) : (
        areas.map((area) => (
          <Pressable
            key={area.href}
            accessibilityRole="button"
            accessibilityLabel={`${area.title}. ${area.description}`}
            onPress={() => router.push(area.href as never)}
            style={({ pressed }) => [
              styles.area,
              { backgroundColor: theme.cardBg, borderColor: theme.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.title, { color: theme.textPrimary }]}>{area.title}</Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {area.description}
            </Text>
            {area.superuserOnly && (
              <Text style={[styles.badge, { color: theme.muted }]}>Somente superusuário</Text>
            )}
          </Pressable>
        ))
      )}
    </AppShell>
  )
}

const styles = StyleSheet.create({
  area: { gap: 4, padding: 16, borderWidth: 1, borderRadius: 12 },
  pressed: { opacity: 0.85 },
  title: { fontSize: 16, fontWeight: '700' },
  description: { fontSize: 13, lineHeight: 18 },
  badge: { fontSize: 11, marginTop: 4 },
})
