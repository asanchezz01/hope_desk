import { validateDecimalInput } from './decimal-input'

describe('validateDecimalInput', () => {
  it('aceita vírgula decimal e ponto decimal simples', () => {
    expect(validateDecimalInput('1500,75', 'o valor').ok).toBe(true)
    expect(validateDecimalInput('1500.75', 'o valor').ok).toBe(true)
    expect(validateDecimalInput('10,5', 'as horas').ok).toBe(true)
    expect(validateDecimalInput('16', 'a franquia').ok).toBe(true)
  })

  it('bloqueia o separador de milhar — o erro de mil vezes', () => {
    // A API aceitaria "1.500" e gravaria 1,50, como o `float()` do legado.
    // Quem digitou queria R$ 1.500,00. É o caso que esta guarda existe para
    // impedir, sem mudar o comportamento do servidor.
    const result = validateDecimalInput('1.500', 'o valor')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('separador de milhar')
  })

  it('bloqueia milhares em qualquer tamanho', () => {
    expect(validateDecimalInput('1.234.567', 'o valor').ok).toBe(false)
    expect(validateDecimalInput('12.345', 'o valor').ok).toBe(false)
  })

  it('bloqueia mistura de ponto e vírgula', () => {
    // A API também rejeitaria "1.234,56", mas com mensagem genérica.
    expect(validateDecimalInput('1.234,56', 'o valor').ok).toBe(false)
    expect(validateDecimalInput('1,234,56', 'o valor').ok).toBe(false)
  })

  it('exige valor', () => {
    expect(validateDecimalInput('', 'o valor').error).toBe('Informe o valor.')
    expect(validateDecimalInput('   ', 'as horas pagas').error).toBe('Informe as horas pagas.')
  })

  it('recusa texto e valores negativos', () => {
    expect(validateDecimalInput('abc', 'o valor').ok).toBe(false)
    // A API também recusa negativo; barrar aqui evita o round-trip.
    expect(validateDecimalInput('-10', 'o valor').ok).toBe(false)
  })

  it('não confunde decimal de 3 casas com milhar quando há vírgula', () => {
    expect(validateDecimalInput('0,750', 'as horas').ok).toBe(true)
  })
})
