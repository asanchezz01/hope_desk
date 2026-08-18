import { useEffect, useRef, useState } from 'react'

import { useReducedMotion } from '../../theme/useReducedMotion'

/** Desaceleração no fim: começa rápido e assenta, em vez de parar de repente. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * Progresso 0→1 para revelar um gráfico, reiniciado quando `key` muda.
 *
 * É `requestAnimationFrame` e estado de React em vez de `Animated`: o que anima
 * aqui é a GEOMETRIA (a altura da coluna com o topo arredondado, o comprimento
 * do arco), e o `Animated` do React Native só interpola propriedades de estilo
 * — chegar no atributo `d` de um `Path` exigiria `setNativeProps` com
 * comportamento diferente em cada plataforma. Um progresso em estado renderiza
 * o mesmo caminho em Web, iOS e Android, e a ~24 quadros num componente só o
 * custo é irrelevante.
 *
 * Com "reduzir movimento" ligado devolve 1 na primeira renderização: o gráfico
 * aparece pronto, sem transição alguma.
 */
export function useReveal(key: string, durationMs = 520): number {
  const reducedMotion = useReducedMotion()
  const [progress, setProgress] = useState(reducedMotion ? 1 : 0)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (reducedMotion) {
      setProgress(1)
      return
    }

    const start = Date.now()
    setProgress(0)

    const tick = () => {
      const elapsed = Date.now() - start
      const t = Math.min(elapsed / durationMs, 1)
      setProgress(easeOutCubic(t))
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [key, durationMs, reducedMotion])

  return progress
}
