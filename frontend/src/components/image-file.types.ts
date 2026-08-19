// Tipos e constantes comuns da seleção de imagem para a logo — usadas tanto
// pelo Web (seletor de arquivos) quanto pelo nativo (onde a operação não se
// aplica), por isso ficam numa terceira variante sem DOM.

/**
 * Tipos de imagem aceitos para a logo.
 * Espelham a validação do backend (`parameters.service.uploadLogo`): o mesmo
 * conjunto de MIME types, para dar um erro claro antes de gastar o upload.
 */
export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
] as const

/** 1 MB, espelhando o limite do backend (`LOGO_MAX_BYTES`). */
export const LOGO_MAX_BYTES = 1024 * 1024

export interface SelectedImage {
  fileName: string
  contentType: string
  size: number
  /** Data URL (`data:...;base64,...`); o backend remove o prefixo e usa o resto. */
  dataBase64: string
}

/**
 * Tipo a partir da extensão. Alguns navegadores devolvem `File.type` vazio
 * para SVG; a extensão garante um content-type aceito pelo backend.
 */
export function guessImageContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
  }
  return map[ext] ?? ''
}
