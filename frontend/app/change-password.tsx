import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { api } from '../src/api/client'
import { toMessage } from '../src/api/to-message'
import Button from '../src/components/Button'
import Input from '../src/components/Input'
import { useToast } from '../src/components/Toast'
import { useAuth } from '../src/context/AuthProvider'
import AuthLayout from '../src/layout/AuthLayout'
import { useTheme } from '../src/theme/ThemeContext'

const PASSWORD_MIN_LENGTH = 6

/**
 * Única rota autenticada liberada enquanto `mustChangePassword` estiver ativo —
 * a API responde 403 em todo o resto.
 */
export default function ChangePassword() {
  const theme = useTheme()
  const router = useRouter()
  const toast = useToast()
  const { signOut, mustChangePassword } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (submitting) return

    if (!currentPassword) {
      setError('Informe a senha atual.')
      return
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`A nova senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
      return
    }
    if (password === currentPassword) {
      setError('A nova senha deve ser diferente da atual.')
      return
    }
    if (password !== confirmation) {
      setError('As senhas não conferem.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await api.changePassword({ currentPassword, password, confirmation })

      // `revokeAllForUser` derruba TODOS os refresh tokens, inclusive o desta
      // sessão. Continuar na aplicação daria a impressão de que tudo segue
      // normal até o próximo refresh falhar — melhor encerrar aqui.
      toast.show('Senha alterada. Entre novamente com a nova senha.', 'success')
      await signOut()
      router.replace('/login')
    } catch (caught) {
      setError(toMessage(caught))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={mustChangePassword ? 'Defina uma nova senha' : 'Trocar senha'}
      subtitle={
        mustChangePassword
          ? 'Sua conta exige a troca da senha antes de acessar o sistema.'
          : 'Ao confirmar, todas as sessões abertas serão encerradas.'
      }
    >
      <Input
        label="Senha atual"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        disabled={submitting}
      />

      <Input
        label="Nova senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        hint={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`}
        disabled={submitting}
      />

      <Input
        label="Confirme a nova senha"
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void handleSubmit()}
        disabled={submitting}
      />

      {error && (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
          {error}
        </Text>
      )}

      <Button title="Alterar senha" onPress={() => void handleSubmit()} loading={submitting} full />

      <View style={styles.secondary}>
        <Button
          title="Sair"
          variant="secondary"
          onPress={() => void signOut()}
          disabled={submitting}
        />
      </View>
    </AuthLayout>
  )
}

const styles = StyleSheet.create({
  error: { marginBottom: 12, fontSize: 13, fontWeight: '600' },
  secondary: { marginTop: 12, alignItems: 'center' },
})
