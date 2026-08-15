import { useEffect, useState } from 'react'

/**
 * Atrasa a propagação de um valor que muda a cada tecla.
 *
 * Sem isto, a busca de chamados dispara uma requisição por caractere: "relat"
 * viraria cinco chamadas, das quais só a última interessa — e as respostas
 * podem chegar fora de ordem.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
