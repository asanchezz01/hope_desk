// Gaveta de navegação do celular.
//
// Não é um menu à parte: ela renderiza a MESMA `SidebarNav` da coluna fixa do
// desktop. Era esse o buraco de antes — a coluna tinha quatro atalhos, o menu
// tinha a lista inteira, e as duas listas viviam em arquivos diferentes. Uma
// árvore só significa que nenhum destino pode existir num lugar e faltar no
// outro.
import { FontAwesome6 } from '@expo/vector-icons'
import React from 'react'
import { Modal, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { ApiUser } from '../api/client'
import { useTheme } from '../theme/ThemeContext'
import { Radius } from '../theme/tokens'

import SidebarNav, { SIDEBAR_WIDTH } from './SidebarNav'

interface AppMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: ApiUser | null
  onSignOut: () => void
}

export default function AppMenu({ open, onOpenChange, user, onSignOut }: AppMenuProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

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
          style={[
            styles.panel,
            {
              backgroundColor: theme.surfaceNav,
              borderRightColor: theme.border,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
          ]}
          // Impede que o toque dentro do painel chegue ao fundo e o feche.
          onPress={(event) => event.stopPropagation()}
        >
          <SidebarNav
            user={user}
            onSignOut={onSignOut}
            onNavigate={() => onOpenChange(false)}
            onClose={() => onOpenChange(false)}
          />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/** Botão sanduíche da barra de topo — só existe onde não há coluna fixa. */
export function AppMenuTrigger({ onPress }: { onPress: () => void }) {
  const theme = useTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir menu de navegação"
      onPress={onPress}
      style={({ pressed }) => [
        styles.trigger,
        pressed && { backgroundColor: theme.surfaceMuted },
      ]}
    >
      <FontAwesome6 name="bars" size={16} color={theme.textSecondary} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // `slate-900/50` do padrão: a página continua legível atrás da gaveta, o que
  // ajuda a lembrar de onde se veio.
  backdrop: { flex: 1, backgroundColor: 'rgba(12,25,42,0.5)', flexDirection: 'row' },
  panel: {
    width: SIDEBAR_WIDTH,
    maxWidth: '85%',
    height: '100%',
    borderRightWidth: 1,
  },
  trigger: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
  },
})
