// Preferência de "reduzir movimento" do sistema.
//
// Isolado num módulo próprio por dois motivos: a consulta é assíncrona e
// mudaria de forma se fosse repetida em cada componente animado, e os testes
// precisam de um ponto único para desligar animações de forma determinística.
import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/**
 * `true` quando o usuário pediu movimento reduzido. Enquanto a preferência não
 * é conhecida, devolve `true` — não animar por um instante é menos intrusivo do
 * que animar e cortar a animação ao descobrir que ele não queria.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true)

  useEffect(() => {
    let active = true

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduced(enabled)
      })
      .catch(() => {
        // Plataforma sem suporte: seguir sem movimento reduzido é o padrão
        // esperado numa interface comum.
        if (active) setReduced(false)
      })

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (active) setReduced(enabled)
    })

    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  return reduced
}
