import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { TextStyle } from 'react-native'

import { statusLabel } from '../../domain/ticket-status'
import { useIsDark, useTheme } from '../../theme/ThemeContext'
import { statusChartColor } from '../../theme/chart-palette'
import { Radius } from '../../theme/tokens'

interface StatusBadgeProps {
  status: string
  /** Sobrescreve o rótulo derivado do status. */
  label?: string
  style?: TextStyle
}

/**
 * Cápsula tingida com a cor do estado, no formato do `Badge` do padrão da
 * retaguarda: fundo em ~10% da hue, contorno em ~35%, marcador e texto na hue.
 *
 * O texto só pode usar a cor do estado porque a paleta padronizada passa em
 * contraste nos dois modos — a do produto antigo não passava, e era por isso
 * que o texto tinha de ser neutro. `statusChartColor` escolhe o degrau do tema
 * (600/700 no claro, 400 no escuro): a hue é a mesma, o degrau é que muda.
 *
 * No claro o texto continua neutro: sobre a cápsula tingida o cinza-ardósia dá
 * mais contraste que a própria hue, e o marcador já carrega a cor. No escuro a
 * hue clara é o que se destaca sobre a noite.
 *
 * O rótulo está sempre presente — o significado nunca depende só da cor.
 */
export default function StatusBadge({ status, label, style }: StatusBadgeProps) {
  const theme = useTheme()
  const isDark = useIsDark()
  const text = label ?? statusLabel(status)
  const cor = statusChartColor(status, isDark)

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={'Status: ' + text}
      style={[styles.badge, { backgroundColor: cor + '1a', borderColor: cor + '59' }]}
    >
      <View style={[styles.marker, { backgroundColor: cor }]} />
      <Text style={[styles.text, { color: isDark ? cor : theme.textPrimary }, style as TextStyle]}>
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  marker: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '700' },
})
