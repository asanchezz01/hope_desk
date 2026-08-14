import React, { useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../../theme/ThemeContext'

export interface SelectOption<T> {
  value: T
  label: string
  /** Linha secundária, para desambiguar homônimos (e-mail do cliente etc.). */
  hint?: string
}

interface SelectProps<T> {
  label?: string
  value: T | null
  options: SelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  error?: string
  disabled?: boolean
  /** Exibido no lugar da lista quando não há opção alguma. */
  emptyMessage?: string
}

/**
 * Seletor em modal. O React Native não tem `<select>`, e um Picker nativo
 * diverge tanto entre Android, iOS e Web que a mesma tela ficaria com três
 * comportamentos diferentes — inclusive de acessibilidade.
 */
export default function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Selecione…',
  error,
  disabled = false,
  emptyMessage = 'Nenhuma opção disponível.',
}: SelectProps<T>) {
  const theme = useTheme()
  const [open, setOpen] = useState(false)

  const selected = options.find((option) => option.value === value) ?? null

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          label ? `${label}: ${selected?.label ?? 'nada selecionado'}` : undefined
        }
        accessibilityHint="Abre a lista de opções"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          {
            backgroundColor: theme.cardBg,
            borderColor: error ? theme.danger : theme.border,
          },
          disabled && styles.disabled,
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.value, { color: selected ? theme.textPrimary : theme.muted }]}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Text style={[styles.chevron, { color: theme.muted }]}>▾</Text>
      </Pressable>

      {error && (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
          {error}
        </Text>
      )}

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel="Fechar"
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View
            style={[styles.sheet, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
          >
            {label && (
              <Text
                accessibilityRole="header"
                style={[styles.sheetTitle, { color: theme.textPrimary }]}
              >
                {label}
              </Text>
            )}

            {options.length === 0 ? (
              <Text style={[styles.empty, { color: theme.textSecondary }]}>{emptyMessage}</Text>
            ) : (
              <FlatList
                data={options}
                keyExtractor={(option) => String(option.value)}
                style={styles.list}
                renderItem={({ item }) => {
                  const isSelected = item.value === value
                  return (
                    <Pressable
                      accessibilityRole="menuitem"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        onChange(item.value)
                        setOpen(false)
                      }}
                      style={[styles.option, isSelected && { backgroundColor: theme.background }]}
                    >
                      <View style={styles.optionText}>
                        <Text style={[styles.optionLabel, { color: theme.textPrimary }]}>
                          {item.label}
                        </Text>
                        {item.hint && (
                          <Text style={[styles.optionHint, { color: theme.muted }]}>
                            {item.hint}
                          </Text>
                        )}
                      </View>
                      {isSelected && <Text style={{ color: theme.primary }}>✓</Text>}
                    </Pressable>
                  )
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  disabled: { opacity: 0.6 },
  value: { flex: 1, fontSize: 16 },
  chevron: { fontSize: 14 },
  error: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '70%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  list: { flexGrow: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 15 },
  optionHint: { fontSize: 12, marginTop: 2 },
  empty: { padding: 16, textAlign: 'center' },
})
