import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../../theme/ThemeContext'
import Button from '../Button'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme()
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
        {title}
      </Text>
      <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>
      {actionLabel && onAction && (
        <View style={styles.action}>
          <Button title={actionLabel} onPress={onAction} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8, padding: 32 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  description: { textAlign: 'center', lineHeight: 20, maxWidth: 420 },
  action: { marginTop: 8 },
})
