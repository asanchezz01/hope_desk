// Coluna de navegação da retaguarda — a MESMA árvore serve a lateral fixa do
// desktop e a gaveta do celular. É de propósito: quando eram duas navegações
// diferentes, cada uma tinha a sua lista, e só a do celular era completa.
//
// A forma segue o padrão da retaguarda NewHope (HopeSell/apps/admin): marca no
// topo, seções de assunto no meio, tema e usuário no rodapé.
import { FontAwesome6 } from '@expo/vector-icons'
import { usePathname, useRouter } from 'expo-router'
import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import type { ApiUser } from '../api/client'
import CompanyLogo from '../components/CompanyLogo'
import { useCompanyLogo } from '../hooks/useCompanyLogo'
import { useHeaderTitle } from '../hooks/useHeaderTitle'
import { useTheme, useThemeMode, type ThemeMode } from '../theme/ThemeContext'
import { Radius, Typography } from '../theme/tokens'

import { menuSectionsFor, type NavItem } from './nav-items'

/** Largura da coluna — o `w-64` do padrão. */
export const SIDEBAR_WIDTH = 256

/** Primeira e última inicial, como no avatar do padrão. */
export function iniciais(nome?: string): string {
  if (!nome) return '?'
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (partes[0][0] + ultima).toUpperCase()
}

const MODOS: { mode: ThemeMode; label: string; icon: NavItem['icon']; hint: string }[] = [
  { mode: 'light', label: 'Claro', icon: 'sun', hint: 'Usar sempre o tema claro' },
  { mode: 'dark', label: 'Escuro', icon: 'moon', hint: 'Usar sempre o tema escuro' },
  { mode: 'system', label: 'Sistema', icon: 'desktop', hint: 'Acompanhar o sistema' },
]

interface SidebarNavProps {
  user: ApiUser | null
  onSignOut: () => void
  /** Fecha a gaveta ao navegar. Ausente na lateral fixa, que não fecha. */
  onNavigate?: () => void
  /** Botão de fechar no topo — só a gaveta tem. */
  onClose?: () => void
}

export default function SidebarNav({ user, onSignOut, onNavigate, onClose }: SidebarNavProps) {
  const theme = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const logoUrl = useCompanyLogo()
  const headerTitle = useHeaderTitle()
  const { mode, setMode } = useThemeMode()

  const sections = menuSectionsFor(user)

  function go(href: string) {
    onNavigate?.()
    router.push(href as never)
  }

  return (
    <>
      <View style={[styles.brandRow, { borderBottomColor: theme.border }]}>
        <CompanyLogo size={36} imageWidth={112} src={logoUrl} />
        {/* Sem título configurado a logo fica sozinha — é o caso de quem já tem
            o nome desenhado dentro dela. */}
        {headerTitle !== '' && (
          <Text numberOfLines={1} style={[styles.brandName, { color: theme.textPrimary }]}>
            {headerTitle}
          </Text>
        )}
        {onClose && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar menu"
            onPress={onClose}
            style={({ pressed }) => [
              styles.iconButton,
              styles.iconButtonEnd,
              pressed && { backgroundColor: theme.surfaceMuted },
            ]}
          >
            <FontAwesome6 name="xmark" size={16} color={theme.muted} />
          </Pressable>
        )}
      </View>

      <ScrollView
        accessibilityRole="menubar"
        style={styles.navScroll}
        contentContainerStyle={styles.nav}
      >
        {sections.map((section, index) => (
          <View key={section.title ?? `atalhos-${index}`} style={styles.section}>
            {section.title && (
              <Text style={[styles.sectionTitle, { color: theme.muted }]}>{section.title}</Text>
            )}
            {section.items.map((item) => {
              const active = pathname === item.href
              return (
                <Pressable
                  key={item.href}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: active }}
                  onPress={() => go(item.href)}
                  style={({ pressed }) => [
                    styles.item,
                    active && { backgroundColor: theme.primarySoft },
                    !active && pressed && { backgroundColor: theme.surfaceMuted },
                  ]}
                >
                  {/* Marcador na aresta, em meia-cápsula: repete a seleção sem
                      depender só do fundo tênue. */}
                  <View
                    style={[
                      styles.marker,
                      { backgroundColor: active ? theme.primary : 'transparent' },
                    ]}
                  />
                  <FontAwesome6
                    name={item.icon}
                    size={14}
                    color={active ? theme.primary : theme.muted}
                    style={styles.itemIcon}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.itemLabel,
                      { color: active ? theme.onPrimarySoft : theme.textSecondary },
                      active && styles.itemLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Tema da interface"
          style={[styles.modos, { borderColor: theme.border }]}
        >
          {MODOS.map((opcao) => {
            const selected = mode === opcao.mode
            return (
              <Pressable
                key={opcao.mode}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={opcao.hint}
                onPress={() => setMode(opcao.mode)}
                style={[styles.modo, selected && { backgroundColor: theme.primarySoft }]}
              >
                <FontAwesome6
                  name={opcao.icon}
                  size={12}
                  color={selected ? theme.primary : theme.muted}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.modoLabel,
                    { color: selected ? theme.onPrimarySoft : theme.textSecondary },
                  ]}
                >
                  {opcao.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {user && (
          <View style={styles.userRow}>
            <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
              <Text style={[styles.avatarText, { color: theme.onPrimarySoft }]}>
                {iniciais(user.name)}
              </Text>
            </View>
            <View style={styles.userText}>
              <Text numberOfLines={1} style={[styles.userName, { color: theme.textPrimary }]}>
                {user.name}
              </Text>
              <Text numberOfLines={1} style={[styles.userMail, { color: theme.muted }]}>
                {user.email}
              </Text>
            </View>
            <Pressable
              accessibilityRole="menuitem"
              onPress={() => {
                onNavigate?.()
                onSignOut()
              }}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && { backgroundColor: theme.dangerSoft },
              ]}
            >
              <FontAwesome6 name="right-from-bracket" size={15} color={theme.danger} />
              <Text style={[styles.sairLabel, { color: theme.danger }]}>Sair</Text>
            </Pressable>
          </View>
        )}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  brandName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, flexShrink: 1, minWidth: 0 },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
  },
  iconButtonEnd: { marginLeft: 'auto' },
  navScroll: { flex: 1 },
  nav: { paddingHorizontal: 12, paddingVertical: 16, gap: 20 },
  section: { gap: 2 },
  sectionTitle: { ...Typography.eyebrow, marginBottom: 4, paddingHorizontal: 12 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: Radius.lg,
  },
  marker: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  itemIcon: { width: 16, textAlign: 'center' },
  itemLabel: { ...Typography.label, flexShrink: 1, minWidth: 0 },
  itemLabelActive: { fontWeight: '600' },
  footer: { borderTopWidth: 1, padding: 12, gap: 8 },
  modos: { flexDirection: 'row', borderWidth: 1, borderRadius: Radius.lg, padding: 2 },
  modo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 32,
    borderRadius: Radius.md,
  },
  modoLabel: { fontSize: 12, fontWeight: '600' },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '700' },
  userText: { flex: 1, minWidth: 0 },
  userName: { fontSize: 13, fontWeight: '600' },
  userMail: { fontSize: 11 },
  sairLabel: { fontSize: 13, fontWeight: '600' },
})
