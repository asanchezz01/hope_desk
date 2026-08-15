import { Link } from 'expo-router'
import React, { useState } from 'react'
import { StyleSheet, Text } from 'react-native'

import { api } from '../src/api/client'
import { toMessage } from '../src/api/to-message'
import Button from '../src/components/Button'
import Input from '../src/components/Input'
import AuthLayout from '../src/layout/AuthLayout'
import { useTheme } from '../src/theme/ThemeContext'

export default function ForgotPassword() {
  const theme = useTheme()

  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentMessage, setSentMessage] = useState<string | null>(null)

  async function handleSubmit() {
    if (submitting) return

    const trimmed = email.trim()
    if (!trimmed) {
      setError('Informe o e-mail cadastrado.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      // A API responde exatamente igual exista ou não a conta, e nunca devolve
      // o token no corpo. Mostramos a mensagem dela sem interpretar: qualquer
      // variação nossa aqui vazaria quais e-mails estão cadastrados.
      const response = await api.forgotPassword(trimmed)
      setSentMessage(response.message)
    } catch (caught) {
      setError(toMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  if (sentMessage) {
    return (
      <AuthLayout title="Verifique seu e-mail">
        <Text style={[styles.message, { color: theme.textSecondary }]}>{sentMessage}</Text>
        <Text style={[styles.hint, { color: theme.muted }]}>
          O link vale por 2 horas e só pode ser usado uma vez.
        </Text>
        <Link href="/login" style={[styles.link, { color: theme.primary }]}>
          Voltar para o login
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Esqueci minha senha"
      subtitle="Enviaremos um link de redefinição para o e-mail cadastrado."
    >
      <Input
        label="E-mail"
        placeholder="voce@exemplo.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => void handleSubmit()}
        disabled={submitting}
      />

      {error && (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
          {error}
        </Text>
      )}

      <Button title="Enviar link" onPress={() => void handleSubmit()} loading={submitting} full />

      <Link href="/login" style={[styles.link, { color: theme.primary }]}>
        Voltar para o login
      </Link>
    </AuthLayout>
  )
}

const styles = StyleSheet.create({
  message: { lineHeight: 20 },
  hint: { marginTop: 8, fontSize: 12, lineHeight: 18 },
  error: { marginBottom: 12, fontSize: 13, fontWeight: '600' },
  link: { marginTop: 16, textAlign: 'center', fontSize: 14, fontWeight: '600' },
})
