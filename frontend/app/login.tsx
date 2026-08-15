import { Link } from 'expo-router'
import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { toMessage } from '../src/api/to-message'
import Button from '../src/components/Button'
import Input from '../src/components/Input'
import ThemeToggle from '../src/components/ThemeToggle'
import { useAuth } from '../src/context/AuthProvider'
import AuthLayout from '../src/layout/AuthLayout'
import { useTheme } from '../src/theme/ThemeContext'

export default function Login() {
  const theme = useTheme()
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    // Prevenção de duplo envio: no Web o Enter dispara junto com o clique.
    if (submitting) return

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Informe e-mail e senha.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await signIn(trimmedEmail, password)
      // Sem navegação manual: o gate em app/_layout.tsx redireciona sozinho
      // assim que o usuário aparece — e leva à troca de senha se ela for
      // obrigatória, o que uma navegação daqui atropelaria.
    } catch (caught) {
      // A API devolve a MESMA mensagem para senha errada e e-mail inexistente,
      // de propósito. Não tente distinguir os casos aqui.
      setError(toMessage(caught))
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Acesse com o e-mail cadastrado no Hope Desk."
      footer={<ThemeToggle />}
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
        disabled={submitting}
      />

      <Input
        label="Senha"
        placeholder="Sua senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void handleSubmit()}
        disabled={submitting}
      />

      {error && (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
          {error}
        </Text>
      )}

      <Button title="Entrar" onPress={() => void handleSubmit()} loading={submitting} full />

      <View style={styles.links}>
        <Link href="/forgot-password" style={[styles.link, { color: theme.primary }]}>
          Esqueci minha senha
        </Link>
      </View>
    </AuthLayout>
  )
}

const styles = StyleSheet.create({
  error: { marginBottom: 12, fontSize: 13, fontWeight: '600' },
  links: { marginTop: 16, alignItems: 'center' },
  link: { fontSize: 14, fontWeight: '600' },
})
