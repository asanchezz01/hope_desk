import React, { createElement } from 'react'
import { Platform, StyleSheet, View } from 'react-native'

import { hexOr, isHexColor, normalizeHexInput } from '../../domain/color'
import { useTheme } from '../../theme/ThemeContext'
import { Radius } from '../../theme/tokens'
import Input from '../Input'

interface ColorFieldProps {
  label: string
  /** Cor em `#RRGGBB`. */
  value: string
  onChange: (value: string) => void
  hint?: string
  disabled?: boolean
}

/**
 * Campo de cor: amostra clicável + hexadecimal editável.
 *
 * A amostra é o `<input type="color">` do próprio navegador — o seletor do
 * sistema operacional, com conta-gotas, roda de matiz e as cores recentes de
 * quem está usando. Nenhuma biblioteca: qualquer roda de cor que
 * escrevêssemos aqui seria pior que a que o SO já tem, e o `type="color"`
 * devolve exatamente o `#RRGGBB` que a API valida.
 *
 * No aplicativo nativo o elemento não existe e sobra o campo hexadecimal, que
 * continua funcionando. É coerente com o resto desta tela, que já é web-only
 * no envio das logos.
 */
export default function ColorField({
  label,
  value,
  onChange,
  hint,
  disabled = false,
}: ColorFieldProps) {
  const theme = useTheme()

  // O seletor nativo não sabe o que fazer com um hexadecimal pela metade
  // (`#0d7`), que é o estado normal enquanto se digita. Enquanto isso ele
  // mostra a última cor completa.
  const amostra = hexOr(value, '#000000')
  const incompleta = value !== '' && !isHexColor(value)

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View
          style={[
            styles.swatch,
            { backgroundColor: amostra, borderColor: theme.border },
            disabled && styles.disabled,
          ]}
        >
          {Platform.OS === 'web' &&
            createElement('input', {
              type: 'color',
              value: amostra,
              disabled,
              'aria-label': label,
              onChange: (event: { target: { value: string } }) =>
                onChange(event.target.value),
              // O controle nativo cobre a amostra inteira e fica invisível: o
              // que se vê é o quadrado colorido, e o clique cai no seletor.
              style: {
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: disabled ? 'default' : 'pointer',
                border: 'none',
                padding: 0,
              },
            })}
        </View>

        <View style={styles.field}>
          <Input
            label={label}
            value={value}
            onChangeText={(raw) => onChange(normalizeHexInput(raw))}
            autoCapitalize="none"
            placeholder="#000000"
            maxLength={7}
            disabled={disabled}
            error={incompleta ? 'Use o formato #RRGGBB.' : undefined}
            hint={hint}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  // A amostra alinha pela BASE do campo, não pelo centro: o `Input` tem rótulo
  // em cima, e centralizar deixaria o quadrado flutuando na altura do rótulo.
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  swatch: {
    width: 48,
    height: 48,
    marginTop: 24,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  disabled: { opacity: 0.6 },
  field: { flex: 1, minWidth: 0 },
})
