import { FontAwesome6 } from '@expo/vector-icons'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../../theme/ThemeContext'
import { Radius, Typography } from '../../theme/tokens'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Glyph do FontAwesome6 no ladrilho à esquerda. Decorativo. */
  icon?: React.ComponentProps<typeof FontAwesome6>['name']
  /** Ação principal da tela, alinhada à direita. */
  action?: React.ReactNode
}

/**
 * Cabeçalho de tela do padrão da retaguarda NewHope.
 *
 * O título mora AQUI, no conteúdo, e não numa barra de topo: no desktop o
 * padrão não tem barra de topo alguma — a coluna de navegação já diz onde a
 * pessoa está, e uma faixa a mais só rouba altura de lista.
 */
export default function PageHeader({ title, subtitle, icon, action }: PageHeaderProps) {
  const theme = useTheme()

  return (
    <View style={[styles.root, { borderBottomColor: theme.border }]}>
      <View style={styles.left}>
        {icon && (
          <View style={[styles.tile, { backgroundColor: theme.primarySoft }]}>
            <FontAwesome6 name={icon} size={16} color={theme.primary} />
          </View>
        )}
        <View style={styles.text}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text>
          )}
        </View>
      </View>
      {action}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1, minWidth: 0 },
  tile: {
    width: 40,
    height: 40,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flexShrink: 1, minWidth: 0 },
  title: Typography.pageTitle,
  subtitle: { ...Typography.pageSubtitle, marginTop: 2 },
})
