// Entrega de arquivo no WEB.
//
// O PDF não pode ser aberto por link direto: a rota exige `Authorization`, e um
// `<a href>` não carrega o token — resultaria em 401. O arquivo já veio por
// `fetch` autenticado; aqui ele só é entregue ao navegador.

export async function saveAndShareFile(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob)

  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    // Fora do documento o clique não dispara no Firefox.
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  } finally {
    // Revogar de imediato cancela o download em alguns navegadores; o atraso
    // dá tempo de a transferência começar. Sem revogar, o Blob fica retido em
    // memória até a aba fechar.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}
