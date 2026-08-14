import { act, fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { Animated, Text } from 'react-native'

import { ThemeProvider, type ThemeMode } from '../theme/ThemeContext'
import { useReducedMotion } from '../theme/useReducedMotion'

import Button from './Button'
import Card from './Card'
import ConfirmationDialog from './ConfirmationDialog'
import EmptyState from './EmptyState'
import ErrorBoundary from './ErrorBoundary'
import Input from './Input'
import Skeleton from './Skeleton'
import StatusBadge from './StatusBadge'
import ThemeToggle from './ThemeToggle'
import { ToastProvider, useToast } from './Toast'

function renderWithTheme(ui: React.ReactElement, mode: ThemeMode = 'light') {
  return render(<ThemeProvider initialMode={mode}>{ui}</ThemeProvider>)
}

describe('Button', () => {
  it('dispara onPress e se anuncia como botão', () => {
    const onPress = jest.fn()
    renderWithTheme(<Button title="Salvar" onPress={onPress} />)

    const button = screen.getByRole('button', { name: 'Salvar' })
    fireEvent.press(button)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('não dispara quando desabilitado nem quando carregando', () => {
    const onPress = jest.fn()
    const { rerender } = renderWithTheme(<Button title="Salvar" onPress={onPress} disabled />)
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    rerender(
      <ThemeProvider initialMode="light">
        <Button title="Salvar" onPress={onPress} loading />
      </ThemeProvider>
    )
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    // Prevenção de duplo envio: sem isto, tocar duas vezes cria dois registros.
    expect(onPress).not.toHaveBeenCalled()
  })

  it('marca busy enquanto carrega, para o leitor de tela avisar', () => {
    renderWithTheme(<Button title="Salvar" onPress={jest.fn()} loading />)
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAccessibilityState({ busy: true })
  })
})

describe('Input', () => {
  it('expõe rótulo, placeholder e erro anunciável', () => {
    renderWithTheme(
      <Input
        label="E-mail"
        placeholder="voce@exemplo.com"
        value=""
        onChangeText={() => undefined}
        error="Campo obrigatório"
      />
    )

    expect(screen.getByLabelText('E-mail')).toBeTruthy()
    expect(screen.getByPlaceholderText('voce@exemplo.com')).toBeTruthy()
    expect(screen.getByRole('alert')).toHaveTextContent('Campo obrigatório')
  })

  it('mostra a dica quando não há erro, e o erro tem prioridade sobre ela', () => {
    const { rerender } = renderWithTheme(
      <Input label="Senha" value="" onChangeText={() => undefined} hint="Mínimo de 6 caracteres" />
    )
    expect(screen.getByText('Mínimo de 6 caracteres')).toBeTruthy()

    rerender(
      <ThemeProvider initialMode="light">
        <Input
          label="Senha"
          value=""
          onChangeText={() => undefined}
          hint="Mínimo de 6 caracteres"
          error="Senha muito curta"
        />
      </ThemeProvider>
    )
    expect(screen.queryByText('Mínimo de 6 caracteres')).toBeNull()
    expect(screen.getByText('Senha muito curta')).toBeTruthy()
  })
})

describe('StatusBadge', () => {
  it('traduz o status para o rótulo do legado', () => {
    renderWithTheme(
      <Card>
        <StatusBadge status="em_andamento" />
      </Card>
    )
    expect(screen.getByLabelText('Status: Em andamento')).toBeTruthy()
  })

  it('não quebra com status fora do domínio', () => {
    renderWithTheme(<StatusBadge status="aguardando_cliente" />)
    expect(screen.getByText('Aguardando Cliente')).toBeTruthy()
  })
})

describe('Skeleton e EmptyState', () => {
  it('anuncia carregamento e oferece a ação do estado vazio', () => {
    const onAction = jest.fn()
    renderWithTheme(
      <>
        <Skeleton />
        <EmptyState
          title="Sem chamados"
          description="Crie o primeiro chamado para começar."
          actionLabel="Criar chamado"
          onAction={onAction}
        />
      </>
    )

    expect(screen.getByLabelText('Carregando')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Criar chamado' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('não anima quando o sistema pede movimento reduzido', () => {
    // O mock global de useReducedMotion já devolve `true` (ver test/setup.ts).
    const loopSpy = jest.spyOn(Animated, 'loop')
    renderWithTheme(<Skeleton />)
    expect(loopSpy).not.toHaveBeenCalled()
    loopSpy.mockRestore()
  })

  it('anima quando o movimento reduzido está desligado', () => {
    const mocked = useReducedMotion as jest.Mock
    mocked.mockReturnValueOnce(false)

    // A implementação é substituída em vez de apenas espionada: uma animação de
    // verdade continua disparando timers depois que o caso termina, e cada tique
    // vira um `setState` fora de `act`.
    const start = jest.fn()
    const stop = jest.fn()
    const loopSpy = jest
      .spyOn(Animated, 'loop')
      .mockReturnValue({ start, stop, reset: jest.fn() } as unknown as Animated.CompositeAnimation)

    const view = renderWithTheme(<Skeleton />)

    expect(loopSpy).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledTimes(1)

    // E a animação é interrompida ao desmontar, senão ela sobrevive à tela.
    view.unmount()
    expect(stop).toHaveBeenCalledTimes(1)

    loopSpy.mockRestore()
  })
})

describe('ConfirmationDialog', () => {
  it('exige uma decisão explícita', () => {
    const onCancel = jest.fn()
    const onConfirm = jest.fn()
    renderWithTheme(
      <ConfirmationDialog
        visible
        title="Excluir chamado?"
        description="Esta ação não pode ser desfeita."
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    )

    fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('trava os dois botões enquanto a ação está em andamento', () => {
    const onCancel = jest.fn()
    const onConfirm = jest.fn()
    renderWithTheme(
      <ConfirmationDialog
        visible
        busy
        title="Excluir chamado?"
        description="Esta ação não pode ser desfeita."
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    )

    fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }))
    expect(onCancel).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

describe('Toast', () => {
  function Trigger() {
    const { show } = useToast()
    return <Button title="Avisar" onPress={() => show('Chamado criado.', 'success')} />
  }

  it('mostra a mensagem e a remove sozinho depois do tempo', () => {
    jest.useFakeTimers()
    try {
      renderWithTheme(
        <ToastProvider>
          <Trigger />
        </ToastProvider>
      )

      fireEvent.press(screen.getByRole('button', { name: 'Avisar' }))
      expect(screen.getByRole('alert')).toHaveTextContent('Chamado criado.')

      act(() => {
        jest.advanceTimersByTime(3000)
      })
      expect(screen.queryByRole('alert')).toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('ThemeToggle', () => {
  it('marca o modo ativo e troca ao tocar', () => {
    renderWithTheme(<ThemeToggle />, 'light')

    expect(screen.getByLabelText('Usar sempre o tema claro')).toHaveAccessibilityState({
      selected: true,
    })

    fireEvent.press(screen.getByLabelText('Usar sempre o tema escuro'))
    expect(screen.getByLabelText('Usar sempre o tema escuro')).toHaveAccessibilityState({
      selected: true,
    })
  })
})

describe('ErrorBoundary', () => {
  it('mostra a tela de falha em vez de derrubar a árvore inteira', () => {
    const Boom = () => {
      throw new Error('falha proposital')
    }
    // O React registra o erro no console mesmo quando ele é capturado.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      )
      expect(screen.getByText('Algo deu errado')).toBeTruthy()
    } finally {
      spy.mockRestore()
    }
  })

  it('deixa passar a árvore quando não há erro', () => {
    render(
      <ErrorBoundary>
        <Text>conteúdo</Text>
      </ErrorBoundary>
    )
    expect(screen.getByText('conteúdo')).toBeTruthy()
  })
})
