import { fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { Text } from 'react-native'

import { publicDarkLogoUrl, publicLogoUrl } from '../api/admin'
import ThemeToggle from '../components/ThemeToggle'
import { ThemeProvider } from '../theme/ThemeContext'

import { useCompanyLogo } from './useCompanyLogo'

function LogoUrlProbe() {
  return <Text testID="company-logo-url">{useCompanyLogo()}</Text>
}

describe('useCompanyLogo', () => {
  it('alterna a URL da logo junto com o tema escolhido', () => {
    render(
      <ThemeProvider initialMode="light">
        <ThemeToggle />
        <LogoUrlProbe />
      </ThemeProvider>
    )

    expect(screen.getByTestId('company-logo-url')).toHaveTextContent(publicLogoUrl)

    fireEvent.press(screen.getByRole('radio', { name: 'Usar sempre o tema escuro' }))
    expect(screen.getByTestId('company-logo-url')).toHaveTextContent(publicDarkLogoUrl)

    fireEvent.press(screen.getByRole('radio', { name: 'Usar sempre o tema claro' }))
    expect(screen.getByTestId('company-logo-url')).toHaveTextContent(publicLogoUrl)
  })
})
