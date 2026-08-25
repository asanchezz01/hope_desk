import React from 'react'
import { StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'

import { useTheme } from '../../theme/ThemeContext'
import { Radius, Shadows } from '../../theme/tokens'

interface CardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  padding?: boolean
  /**
   * Cor da faixa de acento na aresta esquerda — a mesma regra do `StatTile`.
   * É orientação de leitura (identifica o papel do bloco na tela), nunca a
   * única portadora de significado: quando ela carrega um estado (status), o
   * rótulo acompanha, como no `StatusBadge`.
   */
  accent?: string
}

export default function Card({ children, style, padding = true, accent }: CardProps) {
  const theme = useTheme()
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBg, borderColor: theme.border },
        accent && styles.cardAccent,
        padding && styles.padded,
        style,
      ]}
    >
      {accent ? <View style={[styles.accent, { backgroundColor: accent }]} /> : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    // `rounded-xl` do padrão: controle 12, cartão 16, contêiner 20–24.
    borderRadius: Radius.xl,
    // A borda é o que separa o cartão do fundo nos dois temas; a sombra é só um
    // reforço no claro, e some visualmente no escuro sem prejuízo. Ela é
    // tingida de azul-noite, nunca de preto puro.
    ...Shadows.card,
  },
  // Só quando há acento: a faixa é posicionada na aresta e precisa ser
  // recortada pelo raio do cartão. Condiciona-se para não alterar o render dos
  // demais cards, que ainda dependem de conteúdo absoluto no card.
  cardAccent: { overflow: 'hidden' },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  padded: { padding: 20 },
})
