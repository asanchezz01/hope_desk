import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '../../theme/ThemeContext'

export type ToastKind = 'success' | 'error' | 'info'

interface ToastState {
  message: string
  kind: ToastKind
}

interface ToastApi {
  show(message: string, kind?: ToastKind): void
  dismiss(): void
}

const ToastContext = createContext<ToastApi | null>(null)

/** Erros ficam mais tempo na tela: costumam pedir uma ação do usuário. */
const DURATION_MS: Record<ToastKind, number> = {
  success: 3000,
  info: 3500,
  error: 6000,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const dismiss = useCallback(() => {
    clearTimer()
    setToast(null)
  }, [clearTimer])

  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      // Uma mensagem nova substitui a anterior e reinicia a contagem — sem isto,
      // o timer antigo fecharia a mensagem nova antes da hora.
      clearTimer()
      setToast({ message, kind })
      timer.current = setTimeout(() => setToast(null), DURATION_MS[kind])
    },
    [clearTimer]
  )

  // Desmontar com timer pendente vaza um setState em componente já removido.
  useEffect(() => clearTimer, [clearTimer])

  const background =
    toast?.kind === 'error'
      ? theme.danger
      : toast?.kind === 'success'
        ? theme.success
        : theme.primary

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      {toast && (
        <View
          accessibilityLiveRegion="polite"
          pointerEvents="box-none"
          style={[styles.wrapper, { bottom: insets.bottom + 24 }]}
        >
          <Pressable
            accessibilityRole="alert"
            accessibilityLabel={`${toast.message}. Toque para fechar.`}
            onPress={dismiss}
            style={[styles.toast, { backgroundColor: background }]}
          >
            <Text style={[styles.text, { color: theme.onAccentText }]}>{toast.message}</Text>
          </Pressable>
        </View>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider.')
  return context
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 520,
    padding: 16,
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  text: { fontSize: 14, fontWeight: '600' },
})
