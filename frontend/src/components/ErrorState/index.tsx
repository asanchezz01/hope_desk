import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { ApiError } from '../../api/client'
import { toMessage } from '../../api/to-message'
import { useTheme } from '../../theme/ThemeContext'
import Button from '../Button'

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
}

/**
 * Estado de falha de carregamento.
 *
 * Falta de conexão recebe tratamento próprio: a causa e a ação do usuário são
 * outras ("verifique a rede" e não "tente de novo"), e tratar as duas como o
 * mesmo erro genérico manda a pessoa investigar o lugar errado.
 */
export default function ErrorState({ error, onRetry }: ErrorStateProps) {
  const theme = useTheme()
  const offline = error instanceof ApiError && error.isOffline

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
        {offline ? 'Sem conexão' : 'Não foi possível carregar'}
      </Text>
      <Text accessibilityRole="alert" style={[styles.message, { color: theme.textSecondary }]}>
        {offline ? 'Verifique sua conexão com a internet e tente novamente.' : toMessage(error)}
      </Text>
      {onRetry && (
        <View style={styles.action}>
          <Button title="Tentar novamente" variant="secondary" onPress={onRetry} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8, padding: 32 },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  message: { textAlign: 'center', lineHeight: 20, maxWidth: 420 },
  action: { marginTop: 8 },
})
