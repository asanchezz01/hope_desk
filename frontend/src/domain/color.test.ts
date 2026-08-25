import { hexOr, isHexColor, normalizeHexInput } from './color'

describe('isHexColor', () => {
  it('aceita seis dígitos, em qualquer caixa, com espaços nas pontas', () => {
    expect(isHexColor('#0d7f57')).toBe(true)
    expect(isHexColor('#0D7F57')).toBe(true)
    expect(isHexColor('  #0d7f57  ')).toBe(true)
  })

  it('recusa o que o seletor nativo não produz nem aceita de volta', () => {
    // Três dígitos e canal alfa ficam de fora de propósito: o `<input
    // type="color">` não os devolve, e o PDF precisa de cor opaca.
    for (const invalido of ['', '#fff', '#0d7f5', '#0d7f57ff', '0d7f57', 'verde', '#0g7f57']) {
      expect(isHexColor(invalido)).toBe(false)
    }
  })
})

describe('normalizeHexInput', () => {
  it('põe o # na frente de quem digitou só os dígitos', () => {
    expect(normalizeHexInput('0d7f57')).toBe('#0d7f57')
  })

  it('não duplica o # nem se acumula ao digitar', () => {
    expect(normalizeHexInput('#0d7f57')).toBe('#0d7f57')
    expect(normalizeHexInput('##0d7f57')).toBe('#0d7f57')
  })

  it('joga fora o que não é dígito hexadecimal', () => {
    expect(normalizeHexInput('#0d 7f 57')).toBe('#0d7f57')
    expect(normalizeHexInput('cor: 0d7f57;')).toBe('#c0d7f5')
  })

  it('colar um `rgb()` não produz a cor colada', () => {
    // `b`, `c`, `d`, `e` e `f` são dígitos hexadecimais válidos, então o `b` de
    // "rgb" entra na conta. Não há o que consertar aqui: o campo é
    // hexadecimal, e a amostra ao lado mostra na hora que não é aquela a cor.
    expect(normalizeHexInput('rgb(13,127,87)')).toBe('#b13127')
  })

  it('corta em seis dígitos', () => {
    expect(normalizeHexInput('0d7f57ff')).toBe('#0d7f57')
  })

  it('deixa digitar letra a letra sem travar no meio', () => {
    // O erro clássico de máscara é recusar o estado intermediário e tornar o
    // campo impossível de preencher pelo teclado.
    expect(normalizeHexInput('')).toBe('#')
    expect(normalizeHexInput('#0')).toBe('#0')
    expect(normalizeHexInput('#0d')).toBe('#0d')
  })
})

describe('hexOr', () => {
  it('devolve a cor quando está completa', () => {
    expect(hexOr('#0d7f57', '#000000')).toBe('#0d7f57')
  })

  it('nunca devolve um valor que o seletor nativo rejeitaria', () => {
    // É o estado normal enquanto se digita: a amostra segura a última cor boa.
    expect(hexOr('#0d7', '#123456')).toBe('#123456')
    expect(hexOr('', '#123456')).toBe('#123456')
  })
})
