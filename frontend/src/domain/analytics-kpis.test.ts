import { averageOpenAgeDays, bucketSeries, completionRate } from './analytics-kpis'

describe('averageOpenAgeDays', () => {
  it('ignora chamados concluídos em vez de contá-los como zero', () => {
    // Dois abertos (10 e 20 dias) e dois concluídos. Contar os nulos como zero
    // daria 7,5 — e a média cairia a cada chamado fechado, que é o oposto do
    // que o indicador quer dizer.
    expect(
      averageOpenAgeDays([{ ageDays: 10 }, { ageDays: null }, { ageDays: 20 }, { ageDays: null }])
    ).toBe(15)
  })

  it('devolve null quando não há nenhum aberto', () => {
    expect(averageOpenAgeDays([{ ageDays: null }])).toBeNull()
    expect(averageOpenAgeDays([])).toBeNull()
  })
})

describe('completionRate', () => {
  it('arredonda para ponto percentual inteiro, como o legado', () => {
    expect(completionRate(1, 3)).toBe(33)
    expect(completionRate(2, 3)).toBe(67)
    expect(completionRate(4, 4)).toBe(100)
  })

  it('devolve null sem chamados no período — não 0%', () => {
    // 0% afirmaria "nada foi concluído"; sem chamados não há o que concluir.
    expect(completionRate(0, 0)).toBeNull()
  })
})

describe('bucketSeries', () => {
  it('mantém as faixas sem movimento, com zero', () => {
    const series = bucketSeries({
      buckets: [
        { key: '01', label: '1' },
        { key: '02', label: '2' },
        { key: '03', label: '3' },
      ],
      hoursByBucket: { '02': 4.5 },
    })

    expect(series).toEqual([
      { label: '1', value: 0 },
      { label: '2', value: 4.5 },
      { label: '3', value: 0 },
    ])
  })

  it('não inventa faixa que o período não tem', () => {
    // Chave presente no mapa mas fora de `buckets` é ruído do servidor; o eixo
    // é definido pelo período, não pelos dados.
    const series = bucketSeries({
      buckets: [{ key: '01', label: '1' }],
      hoursByBucket: { '01': 2, '99': 8 },
    })

    expect(series).toEqual([{ label: '1', value: 2 }])
  })
})
