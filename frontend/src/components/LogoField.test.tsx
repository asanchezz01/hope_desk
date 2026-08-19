import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import React from 'react'

import { ThemeProvider } from '../theme/ThemeContext'

import LogoField from './LogoField'
import type { SelectedImage } from './image-file.types'

// O módulo `./image-file` troca de implementação entre Web e nativo. Aqui
// controlamos o resultado da seleção/leitura para exercitar os estados do
// componente sem depender do `<input type="file">` do navegador.
const mockSelectImageFile = jest.fn()
const mockLoadLogoFile = jest.fn()
jest.mock('./image-file', () => ({
  selectImageFile: () => mockSelectImageFile(),
  loadLogoFile: (file: unknown) => mockLoadLogoFile(file),
}))

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider initialMode="light">{ui}</ThemeProvider>)
}

describe('LogoField', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('sem logo (estado inicial / nativo)', () => {
    it('mostra o espaço reservado HD e esconde o upload quando não há `onUpload`', () => {
      renderWithTheme(<LogoField currentUrl={null} />)

      expect(screen.getByText('HD')).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Escolher nova logo' })).toBeNull()
      expect(screen.getByText('A troca da logo é feita pela interface Web.')).toBeTruthy()
    })

    it('mostra o botão de escolher arquivo quando há `onUpload`', () => {
      renderWithTheme(<LogoField currentUrl={null} onUpload={jest.fn()} />)

      expect(screen.getByRole('button', { name: 'Escolher nova logo' })).toBeTruthy()
      // A dica "só pela interface Web" some quando o upload está disponível.
      expect(screen.queryByText('A troca da logo é feita pela interface Web.')).toBeNull()
    })
  })

  describe('com logo já definida', () => {
    it('exibe a prévia e, com `onRemove`, o botão "Tirar logo"', () => {
      const onRemove = jest.fn()
      renderWithTheme(
        <LogoField
          currentUrl="https://exemplo.com/logo.png"
          onUpload={jest.fn()}
          onRemove={onRemove}
        />
      )

      // Com logo: a prévia aparece no lugar do espaço reservado "Sem logo".
      expect(screen.queryByLabelText('Sem logo')).toBeNull()
      expect(screen.getAllByLabelText('Logo da empresa').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByRole('button', { name: 'Remover logo da empresa' })).toBeTruthy()
      expect(screen.getByText('Tirar logo')).toBeTruthy()
    })

    it('não mostra "Tirar logo" quando não há `onRemove`', () => {
      renderWithTheme(<LogoField currentUrl="https://exemplo.com/logo.png" onUpload={jest.fn()} />)

      expect(screen.queryByRole('button', { name: 'Remover logo da empresa' })).toBeNull()
    })

    it('dispara `onRemove` ao tocar em "Tirar logo"', () => {
      const onRemove = jest.fn()
      renderWithTheme(<LogoField currentUrl="https://exemplo.com/logo.png" onRemove={onRemove} />)

      fireEvent.press(screen.getByRole('button', { name: 'Remover logo da empresa' }))
      expect(onRemove).toHaveBeenCalledTimes(1)
    })
  })

  describe('fluxo de seleção de arquivo', () => {
    it('envia a imagem selecionada para `onUpload`', async () => {
      const file = { name: 'logo.png', type: 'image/png', size: 128 } as File
      const selected: SelectedImage = {
        fileName: 'logo.png',
        contentType: 'image/png',
        size: 128,
        dataBase64: 'data:image/png;base64,AAA=',
      }
      const onUpload = jest.fn()

      mockSelectImageFile.mockResolvedValue(file)
      mockLoadLogoFile.mockResolvedValue(selected)

      renderWithTheme(<LogoField currentUrl={null} onUpload={onUpload} />)
      fireEvent.press(screen.getByRole('button', { name: 'Escolher nova logo' }))

      await waitFor(() => expect(mockLoadLogoFile).toHaveBeenCalledWith(file))
      await waitFor(() => expect(onUpload).toHaveBeenCalledWith(selected))
      // Sem erros: nenhum alerta no final.
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('nada acontece quando a seleção é cancelada', async () => {
      const onUpload = jest.fn()
      mockSelectImageFile.mockResolvedValue(null)

      renderWithTheme(<LogoField currentUrl={null} onUpload={onUpload} />)
      fireEvent.press(screen.getByRole('button', { name: 'Escolher nova logo' }))

      await waitFor(() => expect(mockSelectImageFile).toHaveBeenCalledTimes(1))
      expect(mockLoadLogoFile).not.toHaveBeenCalled()
      expect(onUpload).not.toHaveBeenCalled()
    })

    it('mostra o erro da validação como alerta', async () => {
      const onUpload = jest.fn()
      mockSelectImageFile.mockResolvedValue({ name: 'x.txt' } as File)
      mockLoadLogoFile.mockRejectedValue(new Error('Formato não aceito.'))

      renderWithTheme(<LogoField currentUrl={null} onUpload={onUpload} />)
      fireEvent.press(screen.getByRole('button', { name: 'Escolher nova logo' }))

      await waitFor(() => expect(screen.queryByRole('alert')).toBeTruthy())
      // Erro inesperado de JS não vaza o texto interno — mensagem padrão.
      expect(screen.getByRole('alert')).toHaveTextContent(/Não foi possível concluir/i)
      expect(onUpload).not.toHaveBeenCalled()
    })
  })

  describe('feedback de estado', () => {
    it('trava o botão durante o upload (busy)', () => {
      renderWithTheme(<LogoField currentUrl={null} onUpload={jest.fn()} busy />)

      expect(screen.getByRole('button', { name: 'Escolher nova logo' })).toHaveAccessibilityState({
        busy: true,
        disabled: true,
      })
    })

    it('mostra o erro vindo da prop', () => {
      renderWithTheme(<LogoField currentUrl={null} onUpload={jest.fn()} error="Falha ao enviar." />)

      expect(screen.getByRole('alert')).toHaveTextContent('Falha ao enviar.')
    })
  })
})
