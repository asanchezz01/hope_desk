import { useSyncExternalStore } from 'react'

import { publicLogoUrl } from '../api/admin'

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
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

let currentUrl = publicLogoUrl
const listeners = new Set<() => void>()

/**
 * Aponta todos os cabeçalhos para uma URL nova (a logo mudou), furando o cache
 * do navegador. Devolve a URL já versionada, para quem quiser exibi-la direto.
 */
export function refreshCompanyLogo(): string {
  currentUrl = `${publicLogoUrl}?v=${Date.now()}`
  listeners.forEach((notify) => notify())
  return currentUrl
}

function getSnapshot(): string {
  return currentUrl
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
