import { ACCEPTED_IMAGE_TYPES, LOGO_MAX_BYTES, guessImageContentType } from './image-file.types'

describe('image-file.types', () => {
  it('o teto de 1MB casa com o backend (LOGO_MAX_BYTES)', () => {
    expect(LOGO_MAX_BYTES).toBe(1024 * 1024)
  })

  it('aceita o mesmo conjunto de conteúdo do backend', () => {
    expect(ACCEPTED_IMAGE_TYPES).toEqual([
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/svg+xml',
    ])
  })

  describe('guessImageContentType', () => {
    it.each([
      ['logo.png', 'image/png'],
      ['logo.jpg', 'image/jpeg'],
      ['logo.jpeg', 'image/jpeg'],
      ['logo.webp', 'image/webp'],
      ['logo.gif', 'image/gif'],
      ['logo.svg', 'image/svg+xml'],
    ])('mapeia %s para %s', (fileName, expected) => {
      expect(guessImageContentType(fileName)).toBe(expected)
    })

    it('ignora a caixa da extensão', () => {
      expect(guessImageContentType('LOGO.PNG')).toBe('image/png')
      expect(guessImageContentType('logo.SVG')).toBe('image/svg+xml')
    })

    it('usa a última extensão do nome', () => {
      // `arquivo.tar.png` → o que vale é a extensão final.
      expect(guessImageContentType('arquivo.tar.png')).toBe('image/png')
    })

    it.each(['arquivo.txt', 'logo', 'sem-extensao', 'video.mp4'])(
      'não mapeia %s (tipo vazio)',
      (fileName) => {
        expect(guessImageContentType(fileName)).toBe('')
      }
    )
  })
})
