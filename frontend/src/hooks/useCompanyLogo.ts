import { useEffect, useState } from 'react'

import { publicLogoUrl } from '../api/admin'

/**
 * URL da logo da empresa, ou `null` quando não há logo (UI cai na marca "HD").
 *
 * Faz um pedido leve ao endpoint PÚBLICO `GET /parameters/logo` — `200` se a
 * logo existe, `401/404` caso contrário — e só então devolve a URL da imagem.
 *
 * Funciona **antes** do login: a tela de login precisa exibir a logo sem token,
 * e este endpoint é `@Public()` no backend. Não depende de `QueryClientProvider`,
 * por isso também é seguro em testes de layout isolados.
 */
export function useCompanyLogo(): string | null {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    fetch(publicLogoUrl, { method: 'GET' })
      .then((response) => {
        // Só o status interessa: cancela o corpo para não baixar a imagem que o
        // `<img>` do componente vai buscar em seguida.
        if (response.body) {
          const stream = response.body as { cancel?: () => Promise<void> | void }
          if (typeof stream.cancel === 'function') {
            void stream.cancel()
          }
        }
        if (active) {
          setLogoUrl(response.status === 200 ? publicLogoUrl : null)
        }
      })
      .catch(() => {
        // Sem conexão / endpoint indisponível: mantém a marca padrão.
        if (active) {
          setLogoUrl(null)
        }
      })

    return () => {
      active = false
    }
  }, [])

  return logoUrl
}
