import React, { useEffect, useState } from 'react'

import { formatIsoDate, maskBrDate, parseBrDateToIso } from '../../domain/format'
import Input from '../Input'

interface DateFieldProps {
  label: string
  /** Valor em `AAAA-MM-DD`. Vazio = não informado. */
  value: string
  /** Recebe `AAAA-MM-DD`, ou string vazia enquanto a data estiver incompleta. */
  onChange: (value: string) => void
  error?: string
  hint?: string
  disabled?: boolean
}

/**
 * Data pura (sem hora, sem fuso). Exibe `dd/mm/aaaa` e devolve `AAAA-MM-DD`.
 *
 * Como o `DateTimeField`, nada aqui passa por `Date` no caminho de ida: um
 * `new Date('2026-07-15').toISOString()` em São Paulo devolveria `2026-07-14`,
 * e a API grava exatamente o que recebe.
 */
export default function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  disabled = false,
}: DateFieldProps) {
  const [text, setText] = useState(() => (value ? formatIsoDate(value) : ''))

  useEffect(() => {
    const incoming = value ? formatIsoDate(value) : ''
    setText((current) => (parseBrDateToIso(current) === value ? current : incoming))
  }, [value])

  function handleChange(raw: string) {
    const masked = maskBrDate(raw)
    setText(masked)
    onChange(parseBrDateToIso(masked) ?? '')
  }

  return (
    <Input
      label={label}
      value={text}
      onChangeText={handleChange}
      placeholder="dd/mm/aaaa"
      keyboardType="numeric"
      error={error}
      hint={hint}
      disabled={disabled}
      maxLength={10}
    />
  )
}
