import { render, screen } from '@testing-library/react-native'
import React from 'react'

import { ThemeProvider } from '../theme/ThemeContext'

import CompanyLogo from './CompanyLogo'

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider initialMode="light">{ui}</ThemeProvider>)
}

describe('CompanyLogo', () => {
  it('mostra o monograma HD e anuncia a marca quando não há logo', () => {
    // Sem `src`: cai para o monograma "HD" (o `<img>` só existe no Web).
    renderWithTheme(<CompanyLogo size={40} />)

    expect(screen.getByText('HD')).toBeTruthy()
    expect(screen.getByLabelText('Marca Hope Desk')).toBeTruthy()
  })

  it('anuncia a logo da empresa quando há `src`', () => {
    renderWithTheme(<CompanyLogo src="https://exemplo.com/logo.png" size={40} />)

    expect(screen.getByLabelText('Logo da empresa')).toBeTruthy()
    // O monograma continua por trás, cobrindo enquanto a imagem carrega.
    expect(screen.getByText('HD')).toBeTruthy()
  })

  it('variante `initials`: monograma puro, sem rótulo de marca nem de logo', () => {
    // Sem `src` e `variant="initials"` → rótulo vazio (nada que anunciar).
    const { unmount } = renderWithTheme(<CompanyLogo size={40} variant="initials" />)
    expect(screen.getByText('HD')).toBeTruthy()
    expect(screen.queryByLabelText('Marca Hope Desk')).toBeNull()

    unmount()
  })

  it('respeita o tamanho pedido', () => {
    const { unmount } = renderWithTheme(<CompanyLogo size={72} />)
    const view = screen.getByLabelText('Marca Hope Desk')
    expect(view.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: 72, height: 72 })])
    )
    unmount()
  })
})
