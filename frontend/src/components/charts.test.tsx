import { render, screen } from '@testing-library/react-native'
import React from 'react'

import { ThemeProvider } from '../theme/ThemeContext'

import BarList from './BarList'
import StatTile from './StatTile'
import StatusBreakdown from './StatusBreakdown'
import TrendChart from './TrendChart'

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider initialMode="light">{ui}</ThemeProvider>)
}

describe('StatTile', () => {
  it('anuncia rótulo, valor e apoio numa frase só', () => {
    renderWithTheme(<StatTile label="Chamados" value="42" hint="12 em aberto" />)
    expect(screen.getByLabelText('Chamados: 42. 12 em aberto')).toBeTruthy()
  })
})

describe('BarList', () => {
  const items = [
    { key: 'a', label: 'Financeiro', value: 10 },
    { key: 'b', label: 'Estoque', value: 4 },
    { key: 'c', label: 'Fiscal', value: 7 },
  ]

  it('ordena por grandeza, do maior para o menor', () => {
    renderWithTheme(<BarList items={items} />)
    // Cada linha carrega o próprio rótulo acessível com o valor.
    expect(screen.getByLabelText('Financeiro: 10')).toBeTruthy()
    expect(screen.getByLabelText('Fiscal: 7')).toBeTruthy()
    expect(screen.getByLabelText('Estoque: 4')).toBeTruthy()
  })

  it('dobra o excedente em "Outros" em vez de criar mais classes', () => {
    // Passando de ~8 classes as adjacentes deixam de ser distinguíveis; a
    // cauda vira uma linha só.
    const many = Array.from({ length: 12 }, (_, index) => ({
      key: `k${index}`,
      label: `Módulo ${index}`,
      value: 12 - index,
    }))
    renderWithTheme(<BarList items={many} maxItems={8} />)

    // 12 itens, 8 visíveis, 4 somados: 4+3+2+1 = 10.
    expect(screen.getByLabelText('Outros (4): 10')).toBeTruthy()
    expect(screen.queryByLabelText('Módulo 11: 1')).toBeNull()
  })

  it('usa o rótulo de valor quando informado, para horas', () => {
    renderWithTheme(
      <BarList items={[{ key: 'a', label: 'Ana', value: 2.25, valueLabel: '2,25 h' }]} />
    )
    expect(screen.getByLabelText('Ana: 2,25 h')).toBeTruthy()
  })

  it('mostra estado vazio em vez de um gráfico sem barras', () => {
    renderWithTheme(<BarList items={[]} />)
    expect(screen.getByText('Nada a exibir')).toBeTruthy()
  })
})

describe('StatusBreakdown', () => {
  const slices = [
    { key: 'aberto', label: 'Em aberto', count: 5 },
    { key: 'em_andamento', label: 'Em andamento', count: 3 },
    { key: 'resolvido', label: 'Concluído', count: 2 },
    { key: 'fechado', label: 'Fechado', count: 0 },
  ]

  it('mostra rótulo e contagem de cada situação — nunca só a cor', () => {
    // Não é preferência: quatro cores de estado nunca formam uma paleta
    // categórica uniforme, e quem não distingue vermelho de verde precisa de um
    // segundo canal. O rótulo visível é esse canal, e este teste impede que ele
    // seja removido.
    renderWithTheme(<StatusBreakdown slices={slices} />)

    for (const slice of slices) {
      expect(screen.getByText(slice.label)).toBeTruthy()
    }
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('50%')).toBeTruthy() // 5 de 10
  })

  it('inclui todas as situações na descrição acessível', () => {
    renderWithTheme(<StatusBreakdown slices={slices} />)
    expect(
      screen.getByLabelText('Em aberto: 5 (50%), Em andamento: 3 (30%), Concluído: 2 (20%)')
    ).toBeTruthy()
  })

  it('mostra estado vazio quando não há chamado algum', () => {
    renderWithTheme(<StatusBreakdown slices={slices.map((slice) => ({ ...slice, count: 0 }))} />)
    expect(screen.getByText('Nada a exibir')).toBeTruthy()
  })
})

describe('TrendChart', () => {
  const points = [
    { label: 'Jan', value: 4 },
    { label: 'Fev', value: 9 },
    { label: 'Mar', value: 6 },
  ]

  it('descreve a série inteira para leitores de tela', () => {
    renderWithTheme(<TrendChart points={points} measure="chamados" />)
    expect(screen.getByLabelText('Tendência de chamados: Jan 4, Fev 9, Mar 6')).toBeTruthy()
  })

  it('mostra estado vazio sem pontos', () => {
    renderWithTheme(<TrendChart points={[]} measure="chamados" />)
    expect(screen.getByText('Nada a exibir')).toBeTruthy()
  })
})
