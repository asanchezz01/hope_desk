import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import React, { useState } from 'react'
import { StyleSheet, Text } from 'react-native'

import { api } from '../../src/api/client'
import { toMessage } from '../../src/api/to-message'
import Button from '../../src/components/Button'
import Input from '../../src/components/Input'
import { useToast } from '../../src/components/Toast'
import AuthLayout from '../../src/layout/AuthLayout'
import { useTheme } from '../../src/theme/ThemeContext'

/** `validate_new_password` do legado: mínimo de 6 caracteres. */
const PASSWORD_MIN_LENGTH = 6

/**
 * Destino do link enviado por e-mail. O backend monta
 * `<APP_PUBLIC_URL>/reset-password/<token>` (`buildResetPasswordUrl`), com o
 * token como SEGMENTO de caminho — por isso a rota é dinâmica, e não uma query.
 */
export default function ResetPassword() {
  const theme = useTheme()
  const router = useRouter()
  const toast = useToast()
  const { token } = useLocalSearchParams<{ token: string }>()

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (submitting) return

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`A nova senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
      return
    }
    // Confere antes de enviar para não gastar o token — ele é de uso único e
    // seria invalidado mesmo numa tentativa que só falharia por digitação.
    if (password !== confirmation) {
      setError('As senhas não conferem.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await api.resetPassword({ token: String(token), password, confirmation })
      toast.show('Senha redefinida. Faça login com a nova senha.', 'success')
      router.replace('/login')
    } catch (caught) {
      setError(toMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Link inválido">
        <Text style={[styles.message, { color: theme.textSecondary }]}>
          O endereço não contém um token de redefinição. Solicite um link novo.
        </Text>
        <Link href="/forgot-password" style={[styles.link, { color: theme.primary }]}>
          Solicitar novo link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Definir nova senha" subtitle="O link é válido por 2 horas e de uso único.">
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

      <Button
        title="Redefinir senha"
        onPress={() => void handleSubmit()}
        loading={submitting}
        full
      />

      <Link href="/login" style={[styles.link, { color: theme.primary }]}>
        Voltar para o login
      </Link>
    </AuthLayout>
  )
}

const styles = StyleSheet.create({
  message: { lineHeight: 20 },
  error: { marginBottom: 12, fontSize: 13, fontWeight: '600' },
  link: { marginTop: 16, textAlign: 'center', fontSize: 14, fontWeight: '600' },
})
