// Menu completo do sistema — o equivalente do `top-actions-menu` do legado.
//
// ## O buraco que ele fecha
//
// A navegação lateral do `AppShell` só existe a partir de 768px. Abaixo disso
// não havia navegação alguma: quem entrava pelo celular ficava preso na
// primeira tela, sem caminho para o painel, para os relatórios, para as telas
// administrativas ou para trocar a senha. O legado nunca teve esse problema —
// o menu sanduíche aparecia em toda largura.
//
// Por isso o gatilho aqui é incondicional. Em telas largas ele convive com a
// lateral (que é atalho para o que se usa o tempo todo) e guarda a lista
// inteira, exatamente como o legado fazia com a navbar e o sanduíche.
import { usePathname, useRouter } from 'expo-router'
import React from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import ThemeToggle from '../components/ThemeToggle'
import { useTheme } from '../theme/ThemeContext'

import type { MenuItem } from './nav-items'

interface AppMenuProps {
  items: MenuItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nome de quem está logado, para o cabeçalho do painel. */
  userName?: string
  /** Papel legível ("Técnico"/"Cliente"), como o legado mostrava no avatar. */
  userRole?: string
  onSignOut: () => void
}

export default function AppMenu({
  items,
  open,
  onOpenChange,
  userName,
  userRole,
  onSignOut,
}: AppMenuProps) {
  const theme = useTheme()
  const router = useRouter()
  const pathname = usePathname()

  const visible = items.filter((item) => item.visible !== false)

  function go(href: string) {
    onOpenChange(false)
    router.push(href as never)
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange(false)}
    >
      {/* O fundo fecha ao toque: no celular é o gesto esperado, e sem ele o
          menu vira uma armadilha em tela cheia. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fechar menu"
        style={styles.backdrop}
        onPress={() => onOpenChange(false)}
      >
        <Pressable
          accessibilityRole="menu"
          style={[styles.panel, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
          // Impede que o toque dentro do painel chegue ao fundo e o feche.
          onPress={(event) => event.stopPropagation()}
        >
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerText}>
              <Text style={[styles.userName, { color: theme.textPrimary }]} numberOfLines={1}>
                {userName ?? 'Menu'}
              </Text>
              {userRole && (
                <Text style={[styles.userRole, { color: theme.textSecondary }]}>{userRole}</Text>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar menu"
              onPress={() => onOpenChange(false)}
              style={[styles.close, { borderColor: theme.border }]}
            >
              <Text style={[styles.closeLabel, { color: theme.textSecondary }]}>Fechar</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.list}>
            {visible.map((item) => {
              const active = pathname === item.href
              return (
                <Pressable
                  key={item.href}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: active }}
                  onPress={() => go(item.href)}
                  style={[styles.item, active && { backgroundColor: theme.background }]}
                >
                  <View
                    style={[
                      styles.marker,
                      { backgroundColor: active ? theme.primary : 'transparent' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.itemLabel,
                      { color: active ? theme.textPrimary : theme.textSecondary },
                      active && styles.itemLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )
            })}

            <View style={[styles.themeRow, { borderTopColor: theme.border }]}>
              <Text style={[styles.themeLabel, { color: theme.textSecondary }]}>
                Tema da interface
              </Text>
              <ThemeToggle />
            </View>

            <Pressable
              accessibilityRole="menuitem"
              onPress={() => {
                onOpenChange(false)
                onSignOut()
              }}
              style={[styles.item, styles.signOut, { borderTopColor: theme.border }]}
            >
              <View style={styles.marker} />
              <Text style={[styles.itemLabel, styles.itemLabelActive, { color: theme.danger }]}>
                Sair
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/** Botão sanduíche do cabeçalho. Três barras, como no legado. */
export function AppMenuTrigger({ onPress }: { onPress: () => void }) {
  const theme = useTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir menu de navegação"
      onPress={onPress}
      style={[styles.trigger, { borderColor: theme.border }]}
    >
      {[0, 1, 2].map((line) => (
        <View key={line} style={[styles.triggerBar, { backgroundColor: theme.textPrimary }]} />
      ))}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 12,
  },
  panel: {
    width: '100%',
    maxWidth: 320,
    maxHeight: '92%',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerText: { flexShrink: 1 },
  userName: { fontSize: 15, fontWeight: '700' },
  userRole: { fontSize: 12 },
  close: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  closeLabel: { fontSize: 13, fontWeight: '600' },
  list: { paddingVertical: 6 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  marker: { width: 3, height: 20, borderRadius: 2 },
  itemLabel: { fontSize: 15 },
  itemLabelActive: { fontWeight: '700' },
  themeRow: {
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginTop: 6,
    borderTopWidth: 1,
  },
  themeLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  signOut: { marginTop: 6, borderTopWidth: 1 },
  trigger: {
    width: 38,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  triggerBar: { width: 16, height: 2, borderRadius: 1 },
})
