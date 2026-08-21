import { FontAwesome6 } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

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
  /** Mesmo glyph do item correspondente no menu (`nav-items`). */
  icon: React.ComponentProps<typeof FontAwesome6>['name']
  /** Chave da cor no tema. Serve para distinguir as áreas de relance. */
  tone: 'primary' | 'secondary' | 'accent' | 'success'
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
    icon: 'users',
    tone: 'primary',
  },
  {
    href: '/admin/modules',
    title: 'Módulos do sistema',
    description: 'Módulos disponíveis na abertura de chamados.',
    superuserOnly: true,
    icon: 'puzzle-piece',
    tone: 'secondary',
  },
  {
    href: '/admin/parameters',
    title: 'Parâmetros da empresa',
    description: 'Dados do cabeçalho dos relatórios, franquia e fechamento.',
    superuserOnly: true,
    icon: 'building',
    tone: 'accent',
  },
  {
    href: '/admin/payments',
    title: 'Pagamentos',
    description: 'Horas pagas que abatem o banco de horas.',
    superuserOnly: true,
    icon: 'credit-card',
    tone: 'success',
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
    <AppShell title="Administração" navItems={navItemsFor(user)} width="wide">
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
        <View style={styles.grid}>
          {areas.map((area) => {
            const tone = theme[area.tone]
            return (
              <Pressable
                key={area.href}
                accessibilityRole="button"
                accessibilityLabel={`${area.title}. ${area.description}`}
                onPress={() => router.push(area.href as never)}
                style={({ pressed }) => [
                  styles.area,
                  { backgroundColor: theme.cardBg, borderColor: theme.border },
                  // A aresta colorida é a mesma linguagem do cartão de chamado:
                  // a área se reconhece pela cor antes de o texto ser lido.
                  { borderTopWidth: 3, borderTopColor: tone },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.areaHeader}>
                  {/* `+1f` = ~12% de alfa sobre a própria cor da área: separa o
                      ícone do cartão sem exigir uma segunda tabela de cores por
                      tema. Toda cor do tema é `#rrggbb`, então concatenar vale. */}
                  <View style={[styles.iconBadge, { backgroundColor: `${tone}1f` }]}>
                    <FontAwesome6 name={area.icon} size={16} color={tone} />
                  </View>
                  <Text style={[styles.title, { color: theme.textPrimary }]}>{area.title}</Text>
                </View>
                <Text style={[styles.description, { color: theme.textSecondary }]}>
                  {area.description}
                </Text>
                {area.superuserOnly && (
                  <Text style={[styles.badge, { color: theme.muted }]}>Somente superusuário</Text>
                )}
              </Pressable>
            )
          })}
        </View>
      )}
    </AppShell>
  )
}

const styles = StyleSheet.create({
  // `flexBasis` faz a quebra sozinho: cabendo dois cartões de 260 na largura,
  // viram duas colunas; num monitor grande, três ou quatro. Sem consultar
  // breakpoint, e no celular resulta em coluna única.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  area: {
    flexGrow: 1,
    flexBasis: 260,
    minWidth: 0,
    gap: 6,
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  areaHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  title: { fontSize: 12.8, fontWeight: '700', flexShrink: 1 },
  description: { fontSize: 13, lineHeight: 18 },
  badge: { fontSize: 11, marginTop: 4 },
})
