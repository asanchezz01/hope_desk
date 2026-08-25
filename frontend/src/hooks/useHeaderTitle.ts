import { useQuery, useQueryClient } from '@tanstack/react-query'

import { parametersApi } from '../api/admin'

/** Chave única: o cabeçalho e a tela de parâmetros falam do mesmo dado. */
export const BRANDING_QUERY_KEY = ['branding'] as const

/**
 * Texto ao lado da logo, do parâmetro de empresa `header_title`.
 *
 * Devolve `''` enquanto carrega, e quem chama simplesmente não desenha nada.
 * Não cai para "Hope Desk" durante a carga de propósito: a empresa que trocou o
 * nome veria o nome errado piscar em toda abertura de tela, o que é pior que um
 * espaço vazio por um instante ao lado de uma logo que já está lá.
 *
 * O endpoint é público (as telas de autenticação mostram a marca antes de haver
 * token) e a resposta é cacheável, então isto custa uma requisição por sessão.
 */
export function useHeaderTitle(): string {
  const { data } = useQuery({
    queryKey: BRANDING_QUERY_KEY,
    queryFn: () => parametersApi.branding(),
    staleTime: 5 * 60_000,
  })
  return data?.headerTitle ?? ''
}

/**
 * Marca a marca como suja depois de salvar os parâmetros.
 *
 * Sem isto o cabeçalho continuaria mostrando o título antigo até a próxima
 * recarga da página — e quem acabou de salvar concluiria que não salvou.
 */
export function useRefreshHeaderTitle(): () => void {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: BRANDING_QUERY_KEY })
  }
}
