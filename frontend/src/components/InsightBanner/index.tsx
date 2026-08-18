import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { Insight } from '../../domain/analytics-insights'
import { useTheme } from '../../theme/ThemeContext'

interface InsightBannerProps {
  insights: Insight[]
}

/**
 * As frases de leitura do painel.
 *
 * O texto vem em segmentos (`parts`) e é montado com `Text`, um pedaço por vez.
 * O legado concatenava `innerHTML` com nome de módulo e de técnico vindos do
 * banco — um cliente chamado `Silva & Cia <ME>` desenhava marcação. Aqui nome
 * é texto, sempre.
 *
 * O ícone é acompanhado de cor E de forma, e a frase inteira já diz o que
 * aconteceu: quem não distingue o âmbar do azul lê exatamente a mesma coisa.
 */
export default function InsightBanner({ insights }: InsightBannerProps) {
  const theme = useTheme()

  if (insights.length === 0) return null

  return (
    <View style={styles.container}>
      {insights.map((insight) => {
        const tint = insight.tone === 'attention' ? theme.accent : theme.primary
        return (
          <View
            key={insight.id}
            accessibilityRole="text"
            style={[
              styles.item,
              { backgroundColor: theme.cardBg, borderColor: theme.border, borderLeftColor: tint },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: tint }]}>
              <Text style={[styles.iconGlyph, { color: theme.onAccentText }]}>{insight.icon}</Text>
            </View>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {insight.parts.map((part, index) => (
                <Text
                  key={index}
                  style={part.emphasis ? [styles.strong, { color: theme.textPrimary }] : undefined}
                >
                  {part.text}
                </Text>
              ))}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  // Grade, não pilha: cinco frases em linhas inteiras empurravam os
  // indicadores para fora da primeira tela, e o primeiro número do painel é
  // mais importante que a quinta frase.
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: {
    flexGrow: 1,
    flexBasis: 380,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 10,
  },
  icon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
  text: { flex: 1, fontSize: 13, lineHeight: 19 },
  strong: { fontWeight: '700' },
})
