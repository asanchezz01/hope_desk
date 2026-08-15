// Entrega de arquivo no NATIVO (Android/iOS).
//
// O Metro escolhe automaticamente entre este arquivo e `save-file.web.ts` pela
// extensão de plataforma. A separação existe porque não há nada em comum entre
// as duas implementações: no Web o navegador baixa; no nativo o arquivo precisa
// ser gravado em disco e entregue à folha de compartilhamento do sistema.
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'

/**
 * Converte o Blob em base64.
 *
 * `FileSystem.writeAsStringAsync` só aceita string, e o React Native não tem
 * `Buffer`. O `FileReader` do RN devolve uma data URL (`data:...;base64,XXX`),
 * da qual só interessa o trecho depois da vírgula.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo recebido.'))
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const separator = result.indexOf(',')
      resolve(separator >= 0 ? result.slice(separator + 1) : result)
    }
    reader.readAsDataURL(blob)
  })
}

export async function saveAndShareFile(blob: Blob, filename: string): Promise<void> {
  const base64 = await blobToBase64(blob)
  // `cacheDirectory` e não `documentDirectory`: é um arquivo derivado, que o
  // sistema pode limpar. Guardá-lo permanentemente acumularia relatórios
  // antigos sem que ninguém os apagasse.
  const target = `${FileSystem.cacheDirectory}${filename}`

  await FileSystem.writeAsStringAsync(target, base64, {
    encoding: FileSystem.EncodingType.Base64,
  })

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Compartilhamento não disponível neste aparelho.')
  }

  await Sharing.shareAsync(target, {
    mimeType: 'application/pdf',
    dialogTitle: filename,
    UTI: 'com.adobe.pdf',
  })
}
