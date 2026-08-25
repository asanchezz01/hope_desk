import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../../theme/ThemeContext'

export interface FilterChip {
  key: string
  /** Dimensão recortada — "Módulo", "Técnico"… */
  dimension: string
  /** Valor escolhido, já pronto para leitura. */
  value: string
}

interface FilterChipsProps {
  chips: FilterChip[]
  onRemove: (key: string) => void
  onClearAll: () => void
}

/**
 * O recorte ativo, dito em palavras.
 *
 * Sem isto o filtro cruzado é uma armadilha: alguém clica numa barra, rola a
 * página, e a partir daí lê números recortados achando que são do período
 * inteiro. A pastilha é a resposta para "por que este número mudou" — e é
 * também o botão que desfaz, porque o lugar onde a pessoa percebe o filtro é o
 * lugar onde ela quer removê-lo.
 */
export default function FilterChips({ chips, onRemove, onClearAll }: FilterChipsProps) {
  const theme = useTheme()

  if (chips.length === 0) return null

  return (
    <View style={styles.container}>
      <Text style={[styles.lead, { color: theme.muted }]}>Recorte ativo</Text>

      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          accessibilityRole="button"
          accessibilityLabel={`Remover filtro ${chip.dimension}: ${chip.value}`}
          onPress={() => onRemove(chip.key)}
          style={[
            styles.chip,
            { backgroundColor: theme.primarySoft, borderColor: theme.primary },
          ]}
        >
          <Text style={[styles.chipDimension, { color: theme.muted }]}>{chip.dimension}</Text>
          <Text numberOfLines={1} style={[styles.chipValue, { color: theme.textPrimary }]}>
            {chip.value}
          </Text>
          <Text style={[styles.chipClose, { color: theme.textSecondary }]}>×</Text>
        </Pressable>
      ))}

      {chips.length > 1 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Limpar todos os filtros"
          onPress={onClearAll}
          style={styles.clear}
        >
          <Text style={[styles.clearText, { color: theme.primary }]}>Limpar tudo</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  lead: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    maxWidth: 280,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 999,
  },
  chipDimension: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  chipValue: { flexShrink: 1, fontSize: 13, fontWeight: '600' },
  chipClose: { fontSize: 16, lineHeight: 16, fontWeight: '700' },
  clear: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 },
  clearText: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
})
