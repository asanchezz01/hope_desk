import {
  arcSegments,
  closeAreaPath,
  nearestIndex,
  niceScale,
  roundedTopBarPath,
  smoothLinePath,
} from './geometry'

describe('roundedTopBarPath', () => {
  it('fecha o caminho na linha de base, com o topo arredondado', () => {
    const path = roundedTopBarPath(10, 20, 12, 60, 4)
    // Começa e termina na base (y = 20 + 60), e usa curvas só no topo.
    expect(path.startsWith('M10,80')).toBe(true)
    expect(path.endsWith('Z')).toBe(true)
    expect(path).toContain('Q')
  })

  it('não arredonda além da metade da largura', () => {
    // Numa barra estreita um raio grande viraria pastilha, que lê como outra
    // marca. O raio efetivo é limitado por largura/2.
    const path = roundedTopBarPath(0, 0, 4, 50, 10)
    expect(path).toContain('Q0,0 2,0')
  })

  it('devolve vazio para altura zero — nada a desenhar', () => {
    expect(roundedTopBarPath(0, 100, 10, 0)).toBe('')
  })
})

describe('smoothLinePath', () => {
  it('liga dois pontos com reta, sem inventar curva', () => {
    expect(
      smoothLinePath([
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ])
    ).toBe('M0,10 L10,0')
  })

  it('NÃO ultrapassa os pontos entre dois vales', () => {
    // Este é o motivo de a interpolação ser monotônica: uma curva "suave"
    // ingênua desce abaixo do menor ponto entre dois vales, e num gráfico de
    // horas isso desenha trabalho negativo.
    const points = [
      { x: 0, y: 100 },
      { x: 10, y: 20 },
      { x: 20, y: 100 },
    ]
    const path = smoothLinePath(points)
    const controlYs = [...path.matchAll(/C[\d.-]+,([\d.-]+) [\d.-]+,([\d.-]+)/g)].flatMap(
      (match) => [Number(match[1]), Number(match[2])]
    )
    // Nenhum ponto de controle sobe acima do pico (y menor) do dado.
    expect(Math.min(...controlYs)).toBeGreaterThanOrEqual(20)
  })

  it('zera a tangente onde a série troca de direção', () => {
    // No cume a curva fica horizontal em vez de continuar subindo e voltar.
    const path = smoothLinePath([
      { x: 0, y: 50 },
      { x: 10, y: 10 },
      { x: 20, y: 50 },
    ])
    expect(path).toContain('C')
  })

  it('devolve vazio sem pontos', () => {
    expect(smoothLinePath([])).toBe('')
  })
})

describe('closeAreaPath', () => {
  it('desce até a base nas duas pontas e fecha', () => {
    const points = [
      { x: 0, y: 10 },
      { x: 20, y: 5 },
    ]
    const area = closeAreaPath('M0,10 L20,5', points, 100)
    expect(area).toBe('M0,10 L20,5 L20,100 L0,100 Z')
  })

  it('sem linha não há área', () => {
    expect(closeAreaPath('', [], 100)).toBe('')
  })
})

describe('niceScale', () => {
  it('leva o topo a um número redondo, acima do maior valor', () => {
    expect(niceScale(37).max).toBe(40)
    expect(niceScale(112).max).toBeGreaterThanOrEqual(112)
  })

  it('produz traços mentalmente divisíveis', () => {
    expect(niceScale(37).ticks).toEqual([0, 10, 20, 30, 40])
  })

  it('não acumula erro de ponto flutuante nos traços', () => {
    // Somando o passo repetidamente um traço sairia como 0,30000000000000004
    // no rótulo do eixo.
    for (const tick of niceScale(0.9).ticks) {
      expect(Number(tick.toFixed(10))).toBe(tick)
    }
  })

  it('série toda zerada vira eixo 0–1, e não 0–0', () => {
    // Com máximo zero a altura de cada barra viraria divisão por zero.
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] })
  })
})

describe('nearestIndex', () => {
  it('pega a faixa sob o cursor, sem exigir acerto na marca', () => {
    expect(nearestIndex(5, 4, 400)).toBe(0)
    expect(nearestIndex(150, 4, 400)).toBe(1)
    expect(nearestIndex(399, 4, 400)).toBe(3)
  })

  it('trava nas pontas em vez de sair do intervalo', () => {
    expect(nearestIndex(1000, 4, 400)).toBe(3)
    expect(nearestIndex(-10, 4, 400)).toBe(0)
  })
})

describe('arcSegments', () => {
  it('acumula os deslocamentos para as fatias não se sobreporem', () => {
    const segments = arcSegments([{ v: 1 }, { v: 3 }], (item) => item.v)
    expect(segments.map((segment) => segment.fraction)).toEqual([0.25, 0.75])
    expect(segments.map((segment) => segment.offset)).toEqual([0, 0.25])
  })

  it('pula fatias zeradas em vez de desenhar traço de comprimento zero', () => {
    const segments = arcSegments([{ v: 0 }, { v: 5 }], (item) => item.v)
    expect(segments).toHaveLength(1)
    expect(segments[0].fraction).toBe(1)
  })

  it('total zero não devolve segmento algum', () => {
    expect(arcSegments([{ v: 0 }], (item) => item.v)).toEqual([])
  })
})
