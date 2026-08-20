import { useSyncExternalStore } from 'react'

import { publicDarkLogoUrl, publicLogoUrl } from '../api/admin'
import { useIsDark } from '../theme/ThemeContext'

/**
 * URL da logo da empresa para o `<img>` do {@link CompanyLogo}.
 *
 * Devolve a URL **na hora**, sem sondar o endpoint antes: a sondagem serializava
 * duas idas ao servidor (status + imagem) e o monograma "HD" ficava à mostra
 * durante as duas. Quando não há logo o `GET` devolve 404 e o próprio `<img>`
 * cai para o monograma via `onError`.
 *
 * A resposta é cacheável (ver `ParametersController.getLogo`), então a partir da
 * segunda visita o navegador pinta a imagem sem rede nenhuma. Depois de trocar
 * ou remover a logo, chame {@link refreshCompanyLogo} para furar esse cache.
 */
export function useCompanyLogo(): string {
  const isDark = useIsDark()
  const urls = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return urls[isDark ? 'dark' : 'light']
}

type LogoVariant = 'light' | 'dark'

let currentUrls: Record<LogoVariant, string> = {
  light: publicLogoUrl,
  dark: publicDarkLogoUrl,
}
const listeners = new Set<() => void>()

/**
 * Aponta todos os cabeçalhos para uma URL nova (a logo mudou), furando o cache
 * do navegador. Devolve a URL já versionada, para quem quiser exibi-la direto.
 */
export function refreshCompanyLogo(variant: LogoVariant = 'light'): string {
  const baseUrl = variant === 'dark' ? publicDarkLogoUrl : publicLogoUrl
  const nextUrl = `${baseUrl}?v=${Date.now()}`
  currentUrls = { ...currentUrls, [variant]: nextUrl }
  listeners.forEach((notify) => notify())
  return nextUrl
}

function getSnapshot(): Record<LogoVariant, string> {
  return currentUrls
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
