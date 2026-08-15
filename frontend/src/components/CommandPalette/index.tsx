// Command palette (Fase 11) — **somente Web**.
//
// É um recurso de teclado: sem teclado físico não há Ctrl+K, e no celular o
// caminho natural já são as abas e a navegação da tela. Renderizar em nativo
// custaria um Modal a mais na árvore de toda tela sem entregar nada.
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native'

import { useTheme } from '../../theme/ThemeContext'

import { filterCommands, moveHighlight, type PaletteCommand } from './commands'

export type { PaletteCommand } from './commands'

const IS_WEB = Platform.OS === 'web'

interface CommandPaletteProps {
  commands: PaletteCommand[]
  /**
   * Aberta ou fechada. O estado mora fora porque o botão de descoberta no
   * cabeçalho precisa abri-la — um estado interno obrigaria a um `ref`
   * imperativo para fazer a mesma coisa.
   */
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CommandPalette({ commands, open, onOpenChange }: CommandPaletteProps) {
  const theme = useTheme()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<TextInput>(null)

  const results = useMemo(() => filterCommands(commands, query), [commands, query])

  const close = useCallback(() => {
    onOpenChange(false)
    setQuery('')
    setHighlight(0)
  }, [onOpenChange])

  const run = useCallback(
    (command: PaletteCommand | undefined) => {
      if (!command) return
      close()
      router.push(command.href as never)
    },
    [close, router]
  )

  // Atalho global. `document` só existe no Web, e o efeito inteiro é pulado nas
  // outras plataformas — não é só o listener que não faz sentido lá.
  useEffect(() => {
    if (!IS_WEB || typeof document === 'undefined') return

    function onKeyDown(event: KeyboardEvent) {
      const isToggle = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
      if (isToggle) {
        // Sem isto o Chrome abre a busca da barra de endereços e a palette
        // aparece atrás de um campo que roubou o foco.
        event.preventDefault()
        onOpenChange(!open)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  // O índice destacado precisa voltar ao topo quando a lista muda de tamanho:
  // manter o 4º item destacado numa lista que passou a ter 2 executaria o
  // comando errado no Enter.
  useEffect(() => {
    setHighlight((current) => (current >= results.length ? 0 : current))
  }, [results.length])

  useEffect(() => {
    if (open) {
      // O `requestAnimationFrame` espera o Modal montar; focar antes disso não
      // tem efeito e a pessoa precisa clicar no campo.
      const handle = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(handle)
    }
  }, [open])

  if (!IS_WEB) return null

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={close}
      accessibilityViewIsModal
    >
      <Pressable
        style={styles.backdrop}
        accessibilityRole="button"
        accessibilityLabel="Fechar busca de comandos"
        onPress={close}
      >
        {/* O painel não pode herdar o onPress do fundo: clicar dentro fecharia. */}
        <Pressable
          style={[styles.panel, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
          onPress={(event) => event.stopPropagation()}
        >
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Ir para… (Esc para fechar)"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Buscar comando"
            style={[styles.input, { color: theme.textPrimary, borderBottomColor: theme.border }]}
            onKeyPress={(event) => {
              // `nativeEvent.key` do react-native-web carrega o nome da tecla.
              const key = (event.nativeEvent as { key?: string }).key
              if (key === 'ArrowDown') {
                setHighlight((current) => moveHighlight(current, 1, results.length))
              } else if (key === 'ArrowUp') {
                setHighlight((current) => moveHighlight(current, -1, results.length))
              } else if (key === 'Enter') {
                run(results[highlight])
              } else if (key === 'Escape') {
                close()
              }
            }}
          />

          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {results.length === 0 ? (
              <Text style={[styles.empty, { color: theme.textSecondary }]}>
                Nenhum comando corresponde a “{query}”.
              </Text>
            ) : (
              results.map((command, index) => (
                <Pressable
                  key={command.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: index === highlight }}
                  onPress={() => run(command)}
                  onHoverIn={() => setHighlight(index)}
                  style={[
                    styles.item,
                    index === highlight && { backgroundColor: theme.background },
                  ]}
                >
                  <Text style={[styles.itemLabel, { color: theme.textPrimary }]}>
                    {command.label}
                  </Text>
                  {command.hint ? (
                    <Text style={[styles.itemHint, { color: theme.textSecondary }]}>
                      {command.hint}
                    </Text>
                  ) : null}
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/** Botão de descoberta: sem ele, o atalho só existe para quem já o conhece. */
export function CommandPaletteHint({ onPress }: { onPress: () => void }) {
  const theme = useTheme()
  if (!IS_WEB) return null

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir busca de comandos (Ctrl mais K)"
      onPress={onPress}
      style={[styles.hint, { borderColor: theme.border }]}
    >
      <Text style={[styles.hintLabel, { color: theme.textSecondary }]}>Ctrl K</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    paddingTop: 96,
    paddingHorizontal: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 16,
    fontSize: 15,
    borderBottomWidth: 1,
  },
  results: { maxHeight: 320 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  itemLabel: { fontSize: 14, fontWeight: '600' },
  itemHint: { fontSize: 12 },
  empty: { fontSize: 13, padding: 16 },
  hint: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  hintLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
})
