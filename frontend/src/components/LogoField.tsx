import React, { useState } from 'react'
import { Text, View } from 'react-native'

import { toMessage } from '../api/to-message'
import { useTheme } from '../theme/ThemeContext'

import Button from './Button'
import CompanyLogo from './CompanyLogo'
import { loadLogoFile, selectImageFile } from './image-file'
import type { SelectedImage } from './image-file.types'

interface LogoFieldProps {
  label?: string
  /** URL pública atual da logo (vazia/`null` → exibe o monograma). */
  currentUrl?: string | null
  onUpload?: (selected: SelectedImage) => void
  onRemove?: () => void
  busy?: boolean
  removeBusy?: boolean
  error?: string | null
  previewBackgroundColor?: string
}

/**
 * Prévia + ações da logo da empresa. É agnóstico de plataforma: quem decide
 * se dá upload é quem passa `onUpload` (a tela passa só no Web, onde existe o
 * picker de arquivo). No nativo a prévia ainda aparece, mas o upload fica
 * desabilitado — a operação é web-only.
 */
export default function LogoField({
  label = 'Logo da empresa',
  currentUrl,
  onUpload,
  onRemove,
  busy = false,
  removeBusy = false,
  error,
  previewBackgroundColor,
}: LogoFieldProps) {
  const theme = useTheme()
  const [localError, setLocalError] = useState<string | null>(null)

  const hasLogo = Boolean(currentUrl)
  const shownError = error || localError

  async function handlePick() {
    if (!onUpload) return
    const file = await selectImageFile()
    if (!file) return // cancelou a seleção
    try {
      const selected = await loadLogoFile(file)
      onUpload(selected)
    } catch (cause) {
      setLocalError(toMessage(cause))
    }
  }

  return (
    <View accessibilityLabel={label} style={styles.wrap}>
      <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>
      <View style={styles.row}>
        <View
          style={[
            styles.preview,
            {
              backgroundColor: previewBackgroundColor ?? theme.cardBg,
              borderColor: theme.border,
            },
          ]}
        >
          {hasLogo ? (
            <CompanyLogo src={currentUrl} size={48} imageWidth={168} />
          ) : (
            <View accessibilityLabel="Sem logo" style={styles.placeholder}>
              <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>HD</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {onUpload ? (
            <Button
              title="Escolher arquivo"
              variant="secondary"
              accessibilityLabel="Escolher nova logo"
              loading={busy}
              disabled={busy}
              onPress={() => void handlePick()}
            />
          ) : (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              A troca da logo é feita pela interface Web.
            </Text>
          )}
          {hasLogo && onRemove && (
            <Button
              title="Tirar logo"
              variant="danger"
              accessibilityLabel="Remover logo da empresa"
              loading={removeBusy}
              disabled={removeBusy}
              onPress={onRemove}
            />
          )}
        </View>
      </View>

      {shownError && (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
          {shownError}
        </Text>
      )}
    </View>
  )
}

const styles = {
  wrap: { gap: 10 } as const,
  label: { fontSize: 14, fontWeight: '700' } as const,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  } as const,
  preview: {
    width: 184,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  placeholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  placeholderText: { fontSize: 22, fontWeight: '800', letterSpacing: 1 } as const,
  actions: { flexGrow: 1, gap: 8 } as const,
  hint: { fontSize: 13, fontWeight: '600' } as const,
  error: { fontSize: 13, fontWeight: '600' } as const,
}
