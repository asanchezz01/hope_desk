// Moldura das telas públicas de autenticação.
//
// Segue o padrão da retaguarda NewHope: em tela larga a página abre com um
// painel de marca sobre o azul-noite à esquerda e o formulário à direita —
// a retaguarda se apresenta com a identidade da empresa, não com um formulário
// solto no meio de um fundo chapado. Abaixo do tablet o painel some e sobra o
// formulário centralizado, que é o que cabe no telefone.
//
// `KeyboardAvoidingView` importa aqui: nos formulários de senha o campo fica na
// metade de baixo da tela e, sem isto, o teclado do iOS o cobre.
import { FontAwesome6 } from '@expo/vector-icons'
import React from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Card from '../components/Card'
import CompanyLogo from '../components/CompanyLogo'
import { useCompanyLogo } from '../hooks/useCompanyLogo'
import { useHeaderTitle } from '../hooks/useHeaderTitle'
import { useTheme } from '../theme/ThemeContext'
import { brand, Radius, slate, Typography } from '../theme/tokens'

import { useBreakpoint } from './useBreakpoint'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  showBrandName?: boolean
}

const DESTAQUES: {
  icon: React.ComponentProps<typeof FontAwesome6>['name']
  titulo: string
  texto: string
}[] = [
  {
    icon: 'gauge',
    titulo: 'Painel de indicadores',
    texto: 'Backlog, tempo de resposta e carga por técnico em uma tela.',
  },
  {
    icon: 'ticket',
    titulo: 'Chamados sem planilha',
    texto: 'Abertura, andamento e histórico de atividades no mesmo lugar.',
  },
  {
    icon: 'file-lines',
    titulo: 'Relatório pronto',
    texto: 'Demonstrativo mensal em PDF, com o cabeçalho da empresa.',
  },
]

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  showBrandName = true,
}: AuthLayoutProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const logoUrl = useCompanyLogo()
  const headerTitle = useHeaderTitle()
  const { isDesktop } = useBreakpoint()

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: theme.background }]}
    >
      {isDesktop && <PainelDeMarca titulo={headerTitle} />}

      <ScrollView
        style={styles.formSide}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <CompanyLogo size={56} imageWidth={190} src={logoUrl} />
        {showBrandName && headerTitle !== '' && (
          <Text style={[styles.brand, { color: theme.textPrimary }]}>{headerTitle}</Text>
        )}

        <Card style={styles.card}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
            {title}
          </Text>
          {subtitle && <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text>}
          <View style={styles.body}>{children}</View>
        </Card>

        {footer && <View style={styles.footer}>{footer}</View>}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

/**
 * Metade esquerda: azul-noite com dois halos frios, a mesma noite do HopeCash e
 * do HopeNoc. Não tem tema — é sempre escura, como no padrão, porque é uma
 * superfície de marca e não uma superfície de leitura.
 */
function PainelDeMarca({ titulo }: { titulo: string }) {
  return (
    <View style={styles.brandSide}>
      <View style={styles.haloVerde} />
      <View style={styles.haloAzul} />

      <View style={styles.brandTop}>
        <View style={styles.brandTile}>
          <Text style={styles.brandTileText}>H</Text>
        </View>
        {titulo !== '' && <Text style={styles.brandSideName}>{titulo}</Text>}
      </View>

      <View>
        <Text style={styles.pitch}>A central de chamados que a sua equipe consegue manter.</Text>
        <View style={styles.destaques}>
          {DESTAQUES.map((destaque) => (
            <View key={destaque.icon} style={styles.destaque}>
              <View style={styles.destaqueTile}>
                <FontAwesome6 name={destaque.icon} size={15} color={brand[400]} />
              </View>
              <View style={styles.destaqueTexto}>
                <Text style={styles.destaqueTitulo}>{destaque.titulo}</Text>
                <Text style={styles.destaqueDescricao}>{destaque.texto}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.rodape}>Hope Desk · suporte e chamados da NewHope</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  brandSide: {
    flex: 1,
    maxWidth: '50%',
    justifyContent: 'space-between',
    padding: 48,
    overflow: 'hidden',
    backgroundColor: slate[950],
  },
  // Halos: manchas frias muito discretas em vez de um chapado. A profundidade
  // vem de camadas de azul — nunca de preto empilhado.
  haloVerde: {
    position: 'absolute',
    top: -96,
    right: -96,
    width: 384,
    height: 384,
    borderRadius: Radius.full,
    backgroundColor: brand[500],
    opacity: 0.12,
  },
  haloAzul: {
    position: 'absolute',
    bottom: -128,
    left: -64,
    width: 384,
    height: 384,
    borderRadius: Radius.full,
    backgroundColor: '#38bdf8',
    opacity: 0.08,
  },
  brandTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandTile: {
    width: 40,
    height: 40,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(87,214,161,0.15)',
  },
  brandTileText: { fontSize: 18, fontWeight: '800', color: brand[400] },
  brandSideName: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, color: '#ffffff' },
  pitch: { fontSize: 28, lineHeight: 36, fontWeight: '700', color: '#ffffff', maxWidth: 420 },
  destaques: { marginTop: 32, gap: 20 },
  destaque: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  destaqueTile: {
    width: 40,
    height: 40,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(87,214,161,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(87,214,161,0.20)',
  },
  destaqueTexto: { flexShrink: 1, minWidth: 0 },
  destaqueTitulo: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  destaqueDescricao: { fontSize: 13, lineHeight: 19, color: slate[400], marginTop: 2 },
  rodape: { fontSize: 12, color: slate[500] },
  formSide: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  brand: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  card: { width: '100%', maxWidth: 400, marginTop: 8 },
  title: Typography.heading1,
  subtitle: { ...Typography.pageSubtitle, marginTop: 6 },
  body: { marginTop: 20 },
  footer: { width: '100%', maxWidth: 400, alignItems: 'center', gap: 8 },
})
