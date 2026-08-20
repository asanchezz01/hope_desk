import { useEffect, useState, createElement } from 'react'
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { useTheme } from '../theme/ThemeContext'

interface CompanyLogoProps {
  /** URL da logo (ex.: o endpoint público). Vazio/`null` → marca padrão "HD". */
  src?: string | null
  /** Lado do quadradão, em pontos (a imagem preenche a área recortada). */
  size: number
  /**
   * `logo`: imagem quando houver, senão a marca.
   * `initials`: sempre a marca "HD" (não tenta carregar imagem).
   */
  variant?: 'logo' | 'initials'
  style?: StyleProp<ViewStyle>
}

/**
 * Marca Hope Desk: exibe a logo da empresa quando existe e cai para o monograma
 * "HD" — antes do login (tela de login), no cabeçalho e na prévia do upload.
 *
 * Em web a logo é um `<img>` (o `<Image>` nativo não renderiza fonte remota);
 * no nativo a operação é web-only, então só a marca aparece.
 */
export default function CompanyLogo({ src, size, variant = 'logo', style }: CompanyLogoProps) {
  const theme = useTheme()
  const [failed, setFailed] = useState(false)

  // Trocou de src: refaz o carregamento do zero (evita exibir a image antiga
  // por um instante após a substituição/remoção da logo).
  useEffect(() => {
    setFailed(false)
  }, [src])

  const canShowImage = variant === 'logo' && Boolean(src) && !failed && Platform.OS === 'web'

  return (
    <View
      accessibilityLabel={src ? 'Logo da empresa' : variant === 'initials' ? '' : 'Marca Hope Desk'}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.palette.primary,
        },
        style,
      ]}
    >
      {/* O monograma fica por trás e cobre enquanto a imagem carrega/falha. */}
      <Text
        numberOfLines={1}
        style={[
          styles.initials,
          {
            color: theme.palette.accent,
            fontSize: Math.max(11, Math.round(size * 0.4)),
            letterSpacing: Math.max(0.5, size * 0.02),
          },
        ]}
      >
        HD
      </Text>

      {canShowImage &&
        createElement('img', {
          src,
          // Vazio de propósito: quem anuncia a logo é o `accessibilityLabel` da
          // View acima, e assim o texto alternativo não pisca sobre o monograma
          // enquanto a imagem carrega.
          alt: '',
          onError: () => setFailed(true),
          style: {
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          },
        })}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontWeight: '800',
  },
})
