import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../../theme/ThemeContext'

export interface TooltipRow {
  key: string
  /** Cor da série; vira um traço curto ao lado, nunca a cor do texto. */
  color: string
  label: string
  value: string
}

interface ChartTooltipProps {
  title: string
  rows: TooltipRow[]
  /** Posição horizontal em fração da largura do gráfico (0–1). */
  anchor: number
  hint?: string
}

/**
 * Leitura do ponto sob o cursor.
 *
 * Regras que valem em todo tooltip do painel:
 *
 * - **O valor lidera.** Ele é o texto forte; o nome da série é secundário — a
 *   hierarquia da legenda invertida, porque aqui o leitor já sabe qual série é
 *   e quer o número.
 * - **Traço, não quadrado.** Na densidade do tooltip um bloco preenchido é
 *   tinta de peso-dado fazendo trabalho de rótulo.
 * - **O tooltip nunca é o único caminho.** Todo valor que ele mostra também
 *   está no eixo, no rótulo direto ou na tabela de chamados.
 */
export default function ChartTooltip({ title, rows, anchor, hint }: ChartTooltipProps) {
  const theme = useTheme()

  // Ancorar pelo centro joga o balão para fora nas pontas; a origem desliza de
  // 0% a 100% conforme a posição, então ele encosta na borda em vez de vazar.
  const clamped = Math.max(0, Math.min(1, anchor))

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        {
          left: `${clamped * 100}%`,
          transform: [{ translateX: `${-clamped * 100}%` }],
          backgroundColor: theme.cardBg,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.muted }]}>{title}</Text>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <View style={[styles.key, { backgroundColor: row.color }]} />
          <Text style={[styles.value, { color: theme.textPrimary }]}>{row.value}</Text>
          <Text numberOfLines={1} style={[styles.label, { color: theme.textSecondary }]}>
            {row.label}
          </Text>
        </View>
      ))}
      {hint && <Text style={[styles.hint, { color: theme.muted }]}>{hint}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    minWidth: 132,
    maxWidth: 240,
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 20,
  },
  title: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Traço de 2px: a mesma espessura da linha que ele representa no gráfico.
  key: { width: 12, height: 2, borderRadius: 1 },
  value: { fontSize: 13, fontWeight: '700' },
  label: { flex: 1, fontSize: 12 },
  hint: { fontSize: 11, marginTop: 2 },
})
