import React from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../../theme/ThemeContext'
import Button from '../Button'

interface ConfirmationDialogProps {
  visible: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  /** Ações destrutivas usam o botão vermelho; as demais, o primário. */
  destructive?: boolean
  /** Trava os dois botões enquanto a ação está em andamento. */
  busy?: boolean
  onCancel(): void
  onConfirm(): void
}

export default function ConfirmationDialog({
  visible,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = true,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  const theme = useTheme()

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      // Botão voltar do Android e Esc no Web.
      onRequestClose={busy ? undefined : onCancel}
    >
      <View style={styles.overlay}>
        {/* O fundo clicável é IRMÃO do diálogo, não seu pai. Aninhar Pressables
            faria o toque dentro do diálogo borbulhar e fechá-lo no Web, onde os
            eventos propagam como no DOM. Tocar fora cancela — menos durante a
            ação, quando fechar deixaria o usuário sem saber se ela concluiu. */}
        <Pressable
          accessibilityLabel="Fechar"
          style={StyleSheet.absoluteFill}
          onPress={busy ? undefined : onCancel}
        />
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[styles.dialog, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
        >
          <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
            {title}
          </Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>
          <View style={styles.actions}>
            <Button title={cancelLabel} variant="secondary" disabled={busy} onPress={onCancel} />
            <Button
              title={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              loading={busy}
              onPress={onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    gap: 10,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  title: { fontSize: 19, fontWeight: '700' },
  description: { lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 10 },
})
