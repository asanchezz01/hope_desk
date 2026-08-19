// Seleção e leitura de imagem para a logo no WEB.
//
// No navegador a troca da logo é real: um seletor de arquivos nativo devolve o
// arquivo, que é validado (tipo + tamanho) e lido em base64 para o envio JSON.

import type { SelectedImage } from './image-file.types'
import { ACCEPTED_IMAGE_TYPES, LOGO_MAX_BYTES, guessImageContentType } from './image-file.types'

export type { SelectedImage }
export { ACCEPTED_IMAGE_TYPES, LOGO_MAX_BYTES, guessImageContentType } from './image-file.types'

/**
 * Abre o seletor de arquivos do navegador. Resolve o arquivo escolhido ou
 * `null` quando a pessoa cancela.
 */
export function selectImageFile(
  accept: readonly string[] = ACCEPTED_IMAGE_TYPES
): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept.join(',')
    input.setAttribute('aria-hidden', 'true')
    input.style.position = 'fixed'
    input.style.opacity = '0'
    input.style.width = '1px'
    input.style.height = '1px'

    let settled = false
    const finish = (result: File | null) => {
      if (settled) return
      settled = true
      input.removeEventListener('change', onChange)
      input.removeEventListener('cancel', onCancel)
      if (input.parentNode) input.parentNode.removeChild(input)
      resolve(result)
    }
    const onChange = () => finish(input.files && input.files[0] ? input.files[0] : null)
    const onCancel = () => finish(null)

    input.addEventListener('change', onChange)
    input.addEventListener('cancel', onCancel)

    document.body.appendChild(input)
    // O clique precisa sair do ciclo de eventos do botão que o invocou.
    input.click()
  })
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

/** Valida tipo + tamanho e lê o arquivo para o payload de envio. */
export async function loadLogoFile(file: File): Promise<SelectedImage> {
  const contentType = (file.type || guessImageContentType(file.name)).toLowerCase()
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
    throw new Error('Formato não aceito. Use PNG, JPEG, WebP, GIF ou SVG.')
  }
  if (file.size > LOGO_MAX_BYTES) {
    throw new Error('A logo não pode exceder 1MB.')
  }

  const dataBase64 = await readFileAsBase64(file)
  if (!dataBase64) {
    throw new Error('Não foi possível ler a imagem selecionada.')
  }
  return {
    fileName: file.name,
    contentType,
    size: file.size,
    dataBase64,
  }
}
