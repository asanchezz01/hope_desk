import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'

import { useTheme } from '../../theme/ThemeContext'

interface StatTileProps {
  label: string
  value: string
  /** Linha de apoio: comparação, recorte ou unidade. */
  hint?: string
  /**
   * Cor da barra de acento na borda. É orientação de leitura — agrupa os
   * indicadores por assunto —, nunca a única portadora de informação.
   */
  accent?: string
  /** Número-herói: um por tela, para o indicador que a tela lidera. */
  hero?: boolean
  /** Indicadores fora do recorte de período; recebem fundo recessivo. */
  muted?: boolean
  /**
   * Escape para o contêiner em COLUNA.
   *
   * O `flexBasis: 150` abaixo pressupõe uma LINHA, que é como o painel e os
   * relatórios usam o componente. Empilhado numa coluna, esse mesmo valor vira
   * ALTURA e o quadro fica esticado com metade dele vazia. Quem empilha passa
   * `{ flexBasis: 'auto' }` por aqui.
   */
  style?: StyleProp<ViewStyle>
}

/**
 * Número em destaque.
 *
 * Quando a história é um número só, ele É o gráfico — um gráfico de barra única
 * ou uma pizza de duas fatias diriam menos ocupando mais espaço.
 */
export default function StatTile({
  label,
  value,
  hint,
  accent,
  hero = false,
  muted = false,
  style,
}: StatTileProps) {
  const theme = useTheme()

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${value}${hint ? `. ${hint}` : ''}`}
      style={[
        styles.tile,
        {
          backgroundColor: muted ? theme.background : theme.cardBg,
          borderColor: theme.border,
        },
        hero && styles.tileHero,
        style,
      ]}
    >
      {/* Faixa de acento na aresta, como no painel antigo: identifica o grupo
          sem colorir texto nem competir com o número. */}
      <View style={[styles.accent, { backgroundColor: accent ?? theme.border }]} />

      <Text numberOfLines={2} style={[styles.label, { color: theme.muted }]}>
        {label}
      </Text>
      {/* O número usa cor de TEXTO, não a cor da série: identidade fica com a
          marca colorida ao lado, nunca com o texto. Figuras proporcionais, não
          tabulares — num número grande e isolado o dígito de largura fixa
          deixa "121" frouxo. */}
      <Text style={[hero ? styles.valueHero : styles.value, { color: theme.textPrimary }]}>
        {value}
      </Text>
      {hint && (
        <Text numberOfLines={2} style={[styles.hint, { color: theme.textSecondary }]}>
          {hint}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: 150,
    gap: 3,
    paddingVertical: 14,
    paddingLeft: 17,
    paddingRight: 14,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tileHero: { flexBasis: 230 },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 26, fontWeight: '700', lineHeight: 32 },
  valueHero: { fontSize: 40, fontWeight: '700', lineHeight: 46, letterSpacing: -0.5 },
  hint: { fontSize: 12, lineHeight: 16 },
})
