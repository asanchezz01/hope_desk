// Shell adaptativo (Fase 08).
//
// Uma única árvore serve mobile, tablet e Web: a partir do tablet a navegação
// vira uma coluna fixa à esquerda; no celular ela some do shell e fica a cargo
// das telas (as abas entram na Fase 09, junto com as rotas reais).
import { usePathname, useRouter } from 'expo-router'
import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import CommandPalette, { CommandPaletteHint } from '../components/CommandPalette'
import type { PaletteCommand } from '../components/CommandPalette'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthProvider'
import { useTheme } from '../theme/ThemeContext'

import { useBreakpoint } from './useBreakpoint'

export interface NavItem {
  href: string
  label: string
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
}

export default function AppShell({ children, title, navItems = [], scroll = true }: AppShellProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { hasSideNav, contentMaxWidth } = useBreakpoint()
  const { user, signOut } = useAuth()

  const items = navItems.filter((item) => item.visible !== false)

  const [paletteOpen, setPaletteOpen] = useState(false)

  // Os comandos saem da MESMA lista que a navegação lateral, já filtrada por
  // perfil. Uma lista paralela escrita à mão divergiria na primeira rota nova —
  // e ofereceria à pessoa um destino que a API recusa.
  //
  // Sem `useMemo`: `navItems` já chega como array novo a cada render (as telas
  // chamam `navItemsFor(user)` na própria chamada), então memorizar aqui só
  // acrescentaria a comparação sem nunca acertar o cache.
  const commands: PaletteCommand[] = items.map((item) => ({
    id: item.href,
    label: item.label,
    href: item.href,
  }))

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.brandRow}>
          <View style={[styles.brandMark, { backgroundColor: theme.palette.primary }]}>
            <Text style={[styles.brandInitials, { color: theme.palette.accent }]}>HD</Text>
          </View>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[styles.title, { color: theme.textPrimary }]}
          >
            {title}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {commands.length > 0 && <CommandPaletteHint onPress={() => setPaletteOpen(true)} />}
          <ThemeToggle />
          {user && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sair da conta de ${user.name}`}
              onPress={() => void signOut()}
              style={[styles.signOut, { borderColor: theme.border }]}
            >
              <Text style={[styles.signOutLabel, { color: theme.textSecondary }]}>Sair</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.body}>
        {hasSideNav && items.length > 0 && (
          <View
            accessibilityRole="menubar"
            style={[styles.sideNav, { borderRightColor: theme.border }]}
          >
            {items.map((item) => (
              <SideNavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </View>
        )}

        {scroll ? (
          <ScrollView
            style={styles.content}
            contentContainerStyle={[
              styles.contentInner,
              { paddingBottom: insets.bottom + 24, maxWidth: contentMaxWidth },
            ]}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.contentPlain, { maxWidth: contentMaxWidth }]}>
            {children}
          </View>
        )}
      </View>

      {commands.length > 0 && (
        <CommandPalette commands={commands} open={paletteOpen} onOpenChange={setPaletteOpen} />
      )}
    </View>
  )
}

function SideNavLink({ href, label }: { href: string; label: string }) {
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
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandInitials: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
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
  contentInner: { padding: 16, gap: 16, width: '100%', alignSelf: 'center' },
  contentPlain: { width: '100%', alignSelf: 'center' },
})
