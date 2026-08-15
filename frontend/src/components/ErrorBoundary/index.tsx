// Rede de segurança para erros de renderização (Fase 08).
//
// Sem isto, um erro em qualquer componente desmonta a árvore inteira e o
// usuário fica com a tela em branco — no Web, sem sequer um stack visível.
// Erros de requisição NÃO passam por aqui: são tratados onde a chamada é
// feita, via ApiError.
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { lightTheme } from '../../theme/ThemeContext'

interface Props {
  children: React.ReactNode
  /** Renderizado no lugar da árvore quebrada. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Em produção isto vai para o coletor de erros (Fase 11).
    console.error('[hope-desk] erro de renderização:', error, info.componentStack)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): React.ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)

    // O fallback padrão não usa useTheme: o provider de tema pode ser
    // justamente o que quebrou. Cores fixas garantem uma tela legível.
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Algo deu errado</Text>
        <Text style={styles.description}>
          A tela não pôde ser exibida. Feche e abra o aplicativo novamente. Se o problema continuar,
          avise o suporte.
        </Text>
        <Text style={styles.detail} selectable>
          {error.message}
        </Text>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 32,
    backgroundColor: lightTheme.background,
  },
  title: { fontSize: 20, fontWeight: '700', color: lightTheme.textPrimary },
  description: {
    textAlign: 'center',
    lineHeight: 20,
    color: lightTheme.textSecondary,
    maxWidth: 420,
  },
  detail: { fontSize: 12, color: lightTheme.muted, textAlign: 'center' },
})
