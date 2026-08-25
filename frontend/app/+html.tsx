// Documento HTML da versão Web — a retaguarda roda aqui.
//
// O que este arquivo pode fazer é limitado de propósito: ele envolve a árvore
// do React Native Web, e não participa da renderização das telas nativas
// (iOS/Android nunca passam por aqui).
import { ScrollViewStyleReset } from 'expo-router/html'
import React from 'react'

/**
 * Tipografia e pintura do documento, no padrão da retaguarda NewHope.
 *
 * ponytail: a família só chega no que o NAVEGADOR desenha direto — fundo da
 * página, campos nativos, seleção de texto. Todo `<Text>` do react-native-web
 * carrega a pilha de fonte do sistema numa classe atômica própria, e derrubá-la
 * com `* { font-family: ... !important }` quebraria os glifos do
 * @expo/vector-icons, que também são `<Text>` com fontFamily. Para a fonte
 * valer na árvore inteira: carregar Hanken Grotesk com `expo-font` e declarar
 * `fontFamily` nas entradas de `theme/tokens.ts`.
 */
const ESTILO = `
  :root {
    color-scheme: light dark;
    --hope-papel: #f5f8fa;
    --hope-noite: #07111f;
  }
  html, body, #root { height: 100%; }
  body {
    margin: 0;
    background-color: var(--hope-papel);
    font-family: "Hanken Grotesk", ui-sans-serif, system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  /* Evita o clarão branco antes do React montar, quando o sistema está no
     escuro. O tema de verdade continua sendo escolhido em ThemeContext. */
  @media (prefers-color-scheme: dark) {
    body { background-color: var(--hope-noite); }
  }
  /* A retaguarda é feita de listas longas; a barra discreta é a do padrão. */
  @media (min-width: 768px) {
    * { scrollbar-width: thin; scrollbar-color: rgb(139 160 180 / 0.45) transparent; }
  }
`

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap"
        />

        {/* Sem isto o body rola junto com os ScrollView internos e a página
            ganha duas barras concorrentes. */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: ESTILO }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
