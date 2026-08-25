// Moldura das telas autenticadas, no padrão da retaguarda NewHope.
//
// Uma única árvore serve celular, tablet e Web:
//
//   a partir do tablet  coluna de navegação fixa à esquerda, e NADA no topo —
//                       o título da tela mora no `PageHeader`, dentro do
//                       conteúdo, porque uma faixa de topo só rouba altura de
//                       lista quando a coluna já diz onde a pessoa está;
//   no celular          a mesma coluna vira gaveta, aberta pelo sanduíche da
//                       barra de topo.
//
// Antes havia duas navegações concorrentes (a coluna com quatro atalhos e um
// menu sanduíche com a lista inteira, os dois visíveis no desktop). Agora é uma
// só, completa nas duas larguras — ver `nav-items.ts`.
import { usePathname } from 'expo-router'
import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import CompanyLogo from '../components/CompanyLogo'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../context/AuthProvider'
import { useCompanyLogo } from '../hooks/useCompanyLogo'
import { useHeaderTitle } from '../hooks/useHeaderTitle'
import { useTheme } from '../theme/ThemeContext'

import AppMenu, { AppMenuTrigger } from './AppMenu'
import SidebarNav, { SIDEBAR_WIDTH } from './SidebarNav'
import { menuItemsFor } from './nav-items'
import { useBreakpoint } from './useBreakpoint'

export type { NavItem } from './nav-items'

interface AppShellProps {
  children: React.ReactNode
  title: string
  /** Linha de apoio sob o título, quando a tela tem o que explicar. */
  subtitle?: string
  /** Ação principal da tela, no canto direito do cabeçalho. */
  action?: React.ReactNode
  /**
   * Desliga o ScrollView interno. Telas com lista própria (`FlatList`) precisam
   * disso: uma lista virtualizada dentro de um ScrollView perde a
   * virtualização, avisa no console e rola em dois eixos concorrentes.
   */
  scroll?: boolean
  /**
   * Quanto da tela o conteúdo pode ocupar.
   *
   *   'full'  PADRÃO da retaguarda: sem teto, o conteúdo vai até a borda. É o
   *           `xl:max-w-none` do HopeSell — numa retaguarda cheia de tabela e
   *           grade, cada pixel a mais é coluna visível, e um teto centralizado
   *           ainda faz a borda esquerda saltar de lugar entre telas;
   *   'form'  coluna única. A ÚNICA exceção, e só para formulário de digitação
   *           corrida: um campo de texto de 1600px não é melhor que um de 760 —
   *           o olho perde o começo da linha ao voltar.
   *
   * Não há mais teto intermediário. Existiam dois ('default' 1120 e 'wide'
   * 1360) e a diferença entre eles só produzia telas irmãs desalinhadas.
   */
  width?: 'full' | 'form'
}

export default function AppShell({
  children,
  title,
  subtitle,
  action,
  scroll = true,
  width = 'full',
}: AppShellProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { hasSideNav, formMaxWidth } = useBreakpoint()
  const maxWidth = width === 'form' ? formMaxWidth : undefined
  const { user, signOut } = useAuth()
  const logoUrl = useCompanyLogo()
  const headerTitle = useHeaderTitle()
  const pathname = usePathname()

  const [menuOpen, setMenuOpen] = useState(false)

  // O ícone do cabeçalho é o mesmo do item de menu correspondente: a tela e o
  // caminho que leva até ela usam o mesmo símbolo, e nenhuma tela precisa
  // repetir essa escolha.
  const icon = menuItemsFor(user).find((item) => item.href === pathname)?.icon

  const cabecalho = <PageHeader title={title} subtitle={subtitle} icon={icon} action={action} />

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {hasSideNav && (
        <View
          style={[
            styles.aside,
            {
              backgroundColor: theme.surfaceNav,
              borderRightColor: theme.border,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <SidebarNav user={user} onSignOut={() => void signOut()} />
        </View>
      )}

      <View style={styles.main}>
        {!hasSideNav && (
          <View
            style={[
              styles.topBar,
              {
                backgroundColor: theme.surfaceNav,
                borderBottomColor: theme.border,
                paddingTop: insets.top + 10,
              },
            ]}
          >
            {user && <AppMenuTrigger onPress={() => setMenuOpen(true)} />}
            <CompanyLogo size={30} imageWidth={96} src={logoUrl} />
            {headerTitle !== '' && (
              <Text numberOfLines={1} style={[styles.topBrand, { color: theme.textPrimary }]}>
                {headerTitle}
              </Text>
            )}
          </View>
        )}

        {scroll ? (
          <ScrollView
            style={styles.content}
            contentContainerStyle={[
              styles.contentInner,
              { paddingBottom: insets.bottom + 32, maxWidth },
            ]}
          >
            {cabecalho}
            {children}
          </ScrollView>
        ) : (
          /* Região de tamanho total (flex: 1 => altura e largura contidas na
             coluna lateral): quem traz lista própria (FlatList) precisa do
             contorno BOUNDED para rolar. O recorte de largura + centralização
             mora no container do próprio conteúdo, que é quem conhece o eixo.
             `alignSelf: center` aqui estaria errado: `main` é `column`, mas
             `content` é o pai da lista e encolher a caixa ao conteúdo deixaria
             a FlatList sem altura. */
          <View style={styles.content}>
            <View style={[styles.headerOutside, { maxWidth }]}>{cabecalho}</View>
            {children}
          </View>
        )}
      </View>

      {user && !hasSideNav && (
        <AppMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          user={user}
          onSignOut={() => void signOut()}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  aside: { width: SIDEBAR_WIDTH, flexShrink: 0, borderRightWidth: 1 },
  main: { flex: 1, minWidth: 0 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  topBrand: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, flexShrink: 1, minWidth: 0 },
  content: { flex: 1 },
  // `contentInner` vive no contentContainerStyle de um ScrollView: lá a caixa
  // é um item de uma coluna, então `alignSelf: center` centraliza no eixo
  // HORIZONTAL — o recorte de leitura que queremos. Reutilize no container de
  // conteúdo de qualquer lista própria (`FlatList` da tela de chamados).
  contentInner: { padding: 20, paddingTop: 24, gap: 20, width: '100%', alignSelf: 'center' },
  headerOutside: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 4,
  },
})
