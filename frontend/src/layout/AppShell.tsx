// Shell adaptativo (Fase 08).
//
// Uma única árvore serve mobile, tablet e Web: a partir do tablet a navegação
// vira uma coluna fixa à esquerda.
//
// **No celular ela não existe** — e por muito tempo não existiu nada no lugar,
// o que prendia quem entrava pelo telefone na primeira tela. O menu completo
// (`AppMenu`), com o gatilho sanduíche no cabeçalho, é a navegação de verdade:
// aparece em qualquer largura e carrega a lista inteira, como no legado.
import { FontAwesome6 } from '@expo/vector-icons'
import { usePathname, useRouter } from 'expo-router'
import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import CompanyLogo from '../components/CompanyLogo'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthProvider'
import { useCompanyLogo } from '../hooks/useCompanyLogo'
import { useTheme } from '../theme/ThemeContext'

import AppMenu, { AppMenuTrigger } from './AppMenu'
import { menuItemsFor } from './nav-items'
import { useBreakpoint } from './useBreakpoint'

export interface NavItem {
  href: string
  label: string
  /** Nome do glyph no FontAwesome6 (estilo solid). */
  icon: React.ComponentProps<typeof FontAwesome6>['name']
  /** Ocultar quando o perfil não puder usar. Não é autorização — a API decide. */
  visible?: boolean
}

interface AppShellProps {
  children: React.ReactNode
  title: string
  navItems?: NavItem[]
  /**
   * Desliga o ScrollView interno. Telas com lista própria (`FlatList`) precisam
   * disso: uma lista virtualizada dentro de um ScrollView perde a
   * virtualização, avisa no console e rola em dois eixos concorrentes.
   */
  scroll?: boolean
  /**
   * Quanto da tela o conteúdo pode ocupar.
   *
   *   'wide'    telas em GRADE (painel): as colunas preenchem a largura extra;
   *   'default' listas e leitura corrida — o teto de sempre;
   *   'form'    coluna única: alargar só afasta o rótulo do valor.
   */
  width?: 'default' | 'wide' | 'form'
}

export default function AppShell({
  children,
  title,
  navItems = [],
  scroll = true,
  width = 'default',
}: AppShellProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { hasSideNav, contentMaxWidth, wideMaxWidth, formMaxWidth } = useBreakpoint()
  const maxWidth =
    width === 'form' ? formMaxWidth : width === 'wide' ? wideMaxWidth : contentMaxWidth
  const { user, signOut } = useAuth()
  const logoUrl = useCompanyLogo()

  const items = navItems.filter((item) => item.visible !== false)

  const [menuOpen, setMenuOpen] = useState(false)

  const menuItems = menuItemsFor(user)
  const roleLabel = user ? (user.role === 'client' ? 'Cliente' : 'Técnico') : undefined

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.brandRow}>
          <CompanyLogo size={34} src={logoUrl} />
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[styles.title, { color: theme.textPrimary }]}
          >
            {title}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <ThemeToggle />
          {user && <AppMenuTrigger onPress={() => setMenuOpen(true)} />}
        </View>
      </View>

      <View style={styles.body}>
        {hasSideNav && items.length > 0 && (
          <View
            accessibilityRole="menubar"
            style={[styles.sideNav, { borderRightColor: theme.border }]}
          >
            {items.map((item) => (
              <SideNavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
            ))}
          </View>
        )}

        {scroll ? (
          <ScrollView
            style={styles.content}
            contentContainerStyle={[
              styles.contentInner,
              { paddingBottom: insets.bottom + 24, maxWidth },
            ]}
          >
            {children}
          </ScrollView>
        ) : (
          /* Região de tamanho total (flex: 1 => altura e largura contidas na
             coluna lateral): quem traz lista própria (FlatList) precisa do
             contorno BOUNDED para rolar. O recorte de largura + centralização
             mora no container do próprio conteúdo, que é quem conhece o eixo.
             `alignSelf: center` aqui estaria errado: `body` é `row`, e em row
             o `alignSelf` rege o eixo VERTICAL e ainda encolhe a caixa ao
             conteúdo — a FlatList ficava sem altura e quebrava com itens. */
          <View style={styles.content}>{children}</View>
        )}
      </View>

      {user && (
        <AppMenu
          items={menuItems}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          userName={user.name}
          userRole={roleLabel}
          onSignOut={() => void signOut()}
        />
      )}
    </View>
  )
}

function SideNavLink({
  href,
  label,
  icon,
}: {
  href: string
  label: string
  icon: NavItem['icon']
}) {
  const theme = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const active = pathname === href

  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected: active }}
      onPress={() => router.push(href as never)}
      style={[styles.navLink, active && { backgroundColor: theme.cardBg }]}
    >
      <View
        style={[styles.navMarker, { backgroundColor: active ? theme.primary : 'transparent' }]}
      />
      <FontAwesome6
        name={icon}
        size={14}
        color={active ? theme.textPrimary : theme.textSecondary}
      />
      <Text
        style={[
          styles.navLabel,
          { color: active ? theme.textPrimary : theme.textSecondary },
          active && styles.navLabelActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  title: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signOut: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  signOutLabel: { fontSize: 13, fontWeight: '600' },
  body: { flex: 1, flexDirection: 'row' },
  sideNav: { width: 216, paddingVertical: 12, paddingHorizontal: 8, borderRightWidth: 1, gap: 2 },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  navMarker: { width: 3, height: 18, borderRadius: 2 },
  navLabel: { fontSize: 14 },
  navLabelActive: { fontWeight: '700' },
  content: { flex: 1 },
  // `contentInner` vive no contentContainerStyle de um ScrollView: lá a caixa
  // é um item de uma coluna, então `alignSelf: center` centraliza no eixo
  // HORIZONTAL — o recorte de leitura que queremos. Reutilize no container de
  // conteúdo de qualquer lista própria (`FlatList` da tela de chamados).
  contentInner: { padding: 16, gap: 16, width: '100%', alignSelf: 'center' },
})
