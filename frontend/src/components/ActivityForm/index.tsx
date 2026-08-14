import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { Activity, ActivityInput } from '../../api/activities'
import { toMessage } from '../../api/to-message'
import { durationInHours, nowWallClock, validateActivityPeriod } from '../../domain/wall-clock'
import { useTheme } from '../../theme/ThemeContext'
import Button from '../Button'
import DateTimeField from '../DateTimeField'
import Input from '../Input'

interface ActivityFormProps {
  /** Preenche o formulário para edição; ausente = nova atividade. */
  activity?: Activity
  submitting: boolean
  onSubmit: (input: ActivityInput) => Promise<void>
  onCancel?: () => void
}

export default function ActivityForm({
  activity,
  submitting,
  onSubmit,
  onCancel,
}: ActivityFormProps) {
  const theme = useTheme()

  const [notes, setNotes] = useState(activity?.notes ?? '')
  const [startedAt, setStartedAt] = useState(activity?.startedAt ?? nowWallClock())
  const [endedAt, setEndedAt] = useState(activity?.endedAt ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const duration = durationInHours(startedAt, endedAt)

  async function handleSubmit() {
    if (submitting) return

    const next: Record<string, string> = {}
    if (!notes.trim()) next.notes = 'Descreva a atividade.'

    const period = validateActivityPeriod(startedAt, endedAt)
    if (!period.ok) next.endedAt = period.error as string

    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitError(null)
    try {
      await onSubmit({ notes: notes.trim(), startedAt, endedAt })
      if (!activity) {
        // Formulário de criação volta ao estado inicial; o de edição fecha.
        setNotes('')
        setStartedAt(nowWallClock())
        setEndedAt('')
      }
    } catch (caught) {
      // O conflito de horário é detectado no servidor — a validação local não
      // tem como saber das outras atividades do técnico.
      setSubmitError(toMessage(caught))
    }
  }

  return (
    <View>
      <Input
        label="Descrição da atividade"
        placeholder="O que foi feito"
        value={notes}
        onChangeText={setNotes}
        error={errors.notes}
        multiline
        rows={3}
        maxLength={20000}
        disabled={submitting}
      />

      <DateTimeField
        label="Início"
        value={startedAt}
        onChange={setStartedAt}
        error={errors.startedAt}
        disabled={submitting}
      />

      <DateTimeField
        label="Término"
        value={endedAt}
        onChange={setEndedAt}
        error={errors.endedAt}
        disabled={submitting}
      />

      {duration !== null && duration > 0 && (
        <Text style={[styles.duration, { color: theme.textSecondary }]}>
          Duração: {duration.toFixed(2).replace('.', ',')} h
        </Text>
      )}

      {submitError && (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
          {submitError}
        </Text>
      )}

      <View style={styles.actions}>
        {onCancel && (
          <Button title="Cancelar" variant="secondary" onPress={onCancel} disabled={submitting} />
        )}
        <Button
          title={activity ? 'Salvar alterações' : 'Registrar atividade'}
          onPress={() => void handleSubmit()}
          loading={submitting}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  duration: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  error: { marginBottom: 10, fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
})
