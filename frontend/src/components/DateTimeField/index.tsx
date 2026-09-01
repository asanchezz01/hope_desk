import React, { useEffect, useState } from 'react'

import { maskOnAppend } from '../../domain/format'
import {
  formatWallClockForApi,
  formatWallClockLabel,
  maskBrDateTime,
  parseBrLabel,
} from '../../domain/wall-clock'
import Input from '../Input'

interface DateTimeFieldProps {
  label: string
  /** Valor no formato da API: `YYYY-MM-DDTHH:mm`, hora de parede. Vazio = nulo. */
  value: string
  /** Recebe o formato da API, ou string vazia enquanto a data estiver incompleta. */
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
}

/**
 * Entrada de data e hora de PAREDE.
 *
 * Exibe em `dd/mm/aaaa HH:MM` (o formato que o usuário do legado já conhecia) e
 * devolve `YYYY-MM-DDTHH:mm`, que é o que a API espera. Em nenhum momento o
 * valor passa por `Date` ou por conversão de fuso: para atividades, o horário
 * digitado é gravado literalmente, e qualquer conversão o deslocaria em 3 horas.
 *
 * Um seletor nativo foi descartado de propósito — os pickers de Android, iOS e
 * Web divergem em comportamento e acessibilidade, e todos trabalham com `Date`,
 * que é justamente o tipo que não deve tocar neste valor.
 */
export default function DateTimeField({
  label,
  value,
  onChange,
  error,
  disabled = false,
}: DateTimeFieldProps) {
  // O texto em digitação é estado local: entre "10/03/2026 0" e uma data
  // completa não existe valor de API correspondente, e derivar o texto do
  // `value` a cada tecla apagaria o que a pessoa está escrevendo.
  const [text, setText] = useState(() => (value ? formatWallClockLabel(value) : ''))

  // Sincroniza quando o valor muda por fora (carregar uma atividade para
  // edição, limpar o formulário após salvar).
  useEffect(() => {
    const incoming = value ? formatWallClockLabel(value) : ''
    setText((current) => {
      const currentAsApi = parseBrLabel(current)
      const currentValue = currentAsApi ? formatWallClockForApi(currentAsApi) : ''
      return currentValue === value ? current : incoming
    })
  }, [value])

  function handleChange(raw: string) {
    const next = maskOnAppend(text, raw, maskBrDateTime)
    setText(next)

    const parts = parseBrLabel(next)
    onChange(parts ? formatWallClockForApi(parts) : '')
  }

  return (
    <Input
      label={label}
      value={text}
      onChangeText={handleChange}
      placeholder="dd/mm/aaaa hh:mm"
      keyboardType="numeric"
      hint="Horário local, como no relógio da parede."
      error={error}
      disabled={disabled}
      maxLength={16}
    />
  )
}
