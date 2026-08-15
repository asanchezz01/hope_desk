import React from 'react'
import { StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'

import { useTheme } from '../../theme/ThemeContext'

interface CardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  padding?: boolean
}

export default function Card({ children, style, padding = true }: CardProps) {
  const theme = useTheme()
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBg, borderColor: theme.border },
        padding && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    // A borda é o que separa o card do fundo nos dois temas; a sombra é só um
    // reforço no claro, e some visualmente no escuro sem prejuízo.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  padded: { padding: 16 },
})
