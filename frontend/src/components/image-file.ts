// Seleção de imagem para a logo no NATIVO (Android/iOS).
//
// O Metro resolve esta variante no nativo e a `image-file.web.ts` no Web — a
// mesma separação de `save-file.ts`/`save-file.web.ts`. A troca da logo é
// feita pela interface Web: no nativo não há o que selecionar, então a API é
// mantida (para a importação ser idêntica entre plataformas) mas a operação
// é indisponível.

import type { SelectedImage } from './image-file.types'

export type { SelectedImage }
export { ACCEPTED_IMAGE_TYPES, LOGO_MAX_BYTES, guessImageContentType } from './image-file.types'

/** Sem seletor no nativo — resolve `null` para o fluxo terminar sem erro. */
export function selectImageFile(): Promise<File | null> {
  return Promise.resolve(null)
}

/** Upload indisponível no nativo; a troca é feita pelo navegador. */
export function loadLogoFile(_file: File): Promise<SelectedImage> {
  return Promise.reject(new Error('A troca da logo é feita pela interface Web.'))
}
