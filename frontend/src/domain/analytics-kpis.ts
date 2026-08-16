// Indicadores do Painel que o legado calculava no navegador.
//
// A API devolve as linhas cruas (`tickets`, `activities`, `buckets`) porque era
// assim que o painel antigo funcionava: agregações prontas para os gráficos e
// linhas para a página refazer contas sem novo request. Estas funções repetem
// as contas que ficavam no `<script>` do `analytics.html`, para que os números
// batam com os que a operação conhece.
import type { AnalyticsResponse } from '../api/analytics'

/**
 * Idade média dos chamados ainda abertos, em dias.
 *
 * `ageDays` é nulo para chamado concluído — o legado filtra os nulos antes da
 * média, e não os conta como zero. Tratar nulo como zero puxaria a média para
 * baixo a cada chamado fechado, exatamente ao contrário do que o indicador
 * quer dizer.
 */
export function averageOpenAgeDays(tickets: { ageDays: number | null }[]): number | null {
  const ages = tickets
    .map((ticket) => ticket.ageDays)
    .filter((value): value is number => value !== null)

  if (ages.length === 0) return null
  return ages.reduce((total, value) => total + value, 0) / ages.length
}

/** Taxa de conclusão em pontos percentuais inteiros, como no legado. */
export function completionRate(concluded: number, total: number): number | null {
  if (total === 0) return null
  return Math.round((concluded / total) * 100)
}

/**
 * Horas por faixa do período — o gráfico de atividades do legado.
 *
 * O eixo vem de `buckets`, não das chaves de `hoursByBucket`: um mês com
 * trabalho em três dias precisa mostrar os outros 28 vazios, senão o gráfico
 * mente sobre a distribuição.
 */
export function bucketSeries(
  data: Pick<AnalyticsResponse, 'buckets' | 'hoursByBucket'>
): { label: string; value: number }[] {
  return data.buckets.map((bucket) => ({
    label: bucket.label,
    value: data.hoursByBucket[bucket.key] ?? 0,
  }))
}
