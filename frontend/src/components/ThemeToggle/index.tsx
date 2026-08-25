import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme, useThemeMode, type ThemeMode } from '../../theme/ThemeContext'
import { Radius } from '../../theme/tokens'

const OPTIONS: { mode: ThemeMode; label: string; hint: string }[] = [
  { mode: 'light', label: 'Claro', hint: 'Usar sempre o tema claro' },
  { mode: 'dark', label: 'Escuro', hint: 'Usar sempre o tema escuro' },
  { mode: 'system', label: 'Sistema', hint: 'Acompanhar a preferência do sistema' },
]

/** Seletor de tema. A escolha é persistida e sobrevive ao reinício do app. */
export default function ThemeToggle() {
  const theme = useTheme()
  const { mode, setMode } = useThemeMode()

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Tema da interface"
      style={[styles.group, { borderColor: theme.border, backgroundColor: theme.cardBg }]}
    >
      {OPTIONS.map((option) => {
        const selected = mode === option.mode
        return (
          <Pressable
            key={option.mode}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.hint}
            onPress={() => setMode(option.mode)}
            style={[styles.option, selected && { backgroundColor: theme.primarySoft }]}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? theme.onPrimarySoft : theme.textSecondary },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 2,
  },
  option: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: Radius.md,
  },
  label: { fontSize: 12, fontWeight: '600' },
})
