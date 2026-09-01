import React, { useEffect, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'

import { publicDarkLogoUrl, publicLogoUrl, publicReportLogoUrl } from '../../src/api/admin'
import type { BrandColors } from '../../src/api/admin'
import { toMessage } from '../../src/api/to-message'
import Button from '../../src/components/Button'
import Card from '../../src/components/Card'
import ColorField from '../../src/components/ColorField'
import ConfirmationDialog from '../../src/components/ConfirmationDialog'
import DateField from '../../src/components/DateField'
import EmptyState from '../../src/components/EmptyState'
import ErrorState from '../../src/components/ErrorState'
import Input from '../../src/components/Input'
import LogoField from '../../src/components/LogoField'
import Skeleton from '../../src/components/Skeleton'
import { useToast } from '../../src/components/Toast'
import type { SelectedImage } from '../../src/components/image-file.types'
import { useAuth } from '../../src/context/AuthProvider'
import { isHexColor } from '../../src/domain/color'
import { validateDecimalInput } from '../../src/domain/decimal-input'
import {
  useCompanyParameters,
  useRemoveCompanyLogo,
  useUpdateCompanyParameters,
  useUploadCompanyLogo,
} from '../../src/hooks/useAdmin'
import { refreshCompanyLogo } from '../../src/hooks/useCompanyLogo'
import { useRefreshHeaderTitle } from '../../src/hooks/useHeaderTitle'
import AppShell from '../../src/layout/AppShell'
import { useBreakpoint } from '../../src/layout/useBreakpoint'
import { useTheme } from '../../src/theme/ThemeContext'

type LogoVariant = 'light' | 'dark' | 'report'

/**
 * Os cinco degraus da identidade visual, na ordem em que aparecem na tela.
 *
 * A dica de cada um diz ONDE a cor aparece, e não o que ela é: "cor principal"
 * não ajuda ninguém a decidir, "o verde do cabeçalho do PDF" ajuda. As duas
 * últimas não entram no relatório — o PDF não tem aviso nem erro impresso — e
 * a dica precisa dizer isso, senão alguém troca a cor de alerta esperando ver
 * o documento mudar.
 */
const CAMPOS_DE_COR: { key: keyof BrandColors; label: string; hint: string }[] = [
  {
    key: 'primaryColor',
    label: 'Cor principal',
    hint: 'Botões e destaques da tela, e o verde do cabeçalho do relatório em PDF.',
  },
  {
    key: 'secondaryColor',
    label: 'Cor secundária',
    hint: 'O azul de apoio: subtítulo e dados do chamado no relatório em PDF.',
  },
  {
    key: 'accentColor',
    label: 'Cor de destaque',
    hint: 'O filete âmbar sob o cabeçalho do relatório em PDF.',
  },
  { key: 'infoColor', label: 'Cor de informação', hint: 'Avisos neutros. Só na tela.' },
  { key: 'dangerColor', label: 'Cor de alerta', hint: 'Erros e exclusões. Só na tela.' },
]

/** Antes de a API responder não há cor nenhuma; o campo entra vazio, não preto. */
const CORES_VAZIAS: BrandColors = {
  primaryColor: '',
  secondaryColor: '',
  accentColor: '',
  infoColor: '',
  dangerColor: '',
}

function cacheBustedLogoUrl(url: string) {
  return `${url}?v=${Date.now()}`
}

export default function AdminParameters() {
  const theme = useTheme()
  const toast = useToast()
  const { isSuperuser } = useAuth()
  const { isMobile } = useBreakpoint()

  const refreshHeaderTitle = useRefreshHeaderTitle()
  const parameters = useCompanyParameters(isSuperuser)
  const updateParameters = useUpdateCompanyParameters()
  const uploadLogo = useUploadCompanyLogo('light')
  const uploadDarkLogo = useUploadCompanyLogo('dark')
  const uploadReportLogo = useUploadCompanyLogo('report')
  const removeLogo = useRemoveCompanyLogo('light')
  const removeDarkLogo = useRemoveCompanyLogo('dark')
  const removeReportLogo = useRemoveCompanyLogo('report')
  const [logoUrls, setLogoUrls] = useState<Record<LogoVariant, string | null>>({
    light: null,
    dark: null,
    report: null,
  })
  const [logoBusy, setLogoBusy] = useState<Record<LogoVariant, boolean>>({
    light: false,
    dark: false,
    report: false,
  })
  const [pendingRemove, setPendingRemove] = useState<LogoVariant | null>(null)

  const [headerTitle, setHeaderTitle] = useState('')
  const [colors, setColors] = useState<BrandColors>(CORES_VAZIAS)
  const [companyName, setCompanyName] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [monthlyHoursAllowance, setMonthlyHoursAllowance] = useState('')
  const [activityHourlyRate, setActivityHourlyRate] = useState('')
  const [hoursBankClosingDate, setHoursBankClosingDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loaded = parameters.data !== undefined
  useEffect(() => {
    const data = parameters.data
    if (!data) return
    setHeaderTitle(data.headerTitle)
    setColors({
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      accentColor: data.accentColor,
      infoColor: data.infoColor,
      dangerColor: data.dangerColor,
    })
    setCompanyName(data.companyName)
    setCompanyAddress(data.companyAddress)
    setMonthlyHoursAllowance(data.monthlyHoursAllowance)
    setActivityHourlyRate(data.activityHourlyRate)
    setHoursBankClosingDate(data.hoursBankClosingDate)
    // `companyLogo` é o arquivo gravado (vazio = sem logo); é ele quem diz se a
    // prévia mostra a imagem ou o "sem logo".
    setLogoUrls({
      light: data.companyLogo ? publicLogoUrl : null,
      dark: data.companyLogoDark ? publicDarkLogoUrl : null,
      report: data.reportLogo ? cacheBustedLogoUrl(publicReportLogoUrl) : null,
    })
  }, [loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isSuperuser) {
    return (
      <AppShell title="Parâmetros">
        <Card>
          <EmptyState
            title="Sem permissão"
            description="Os parâmetros da empresa são restritos a superusuários."
          />
        </Card>
      </AppShell>
    )
  }

  async function handleSave() {
    if (updateParameters.isPending) return

    // Mesma ambiguidade do valor de pagamento: "1.500" viraria 1,5 de franquia.
    const allowanceCheck = validateDecimalInput(monthlyHoursAllowance, 'a franquia mensal')
    if (!allowanceCheck.ok) {
      setError(allowanceCheck.error)
      return
    }

    const hourlyRateCheck = validateDecimalInput(activityHourlyRate, 'o valor da hora')
    if (!hourlyRateCheck.ok) {
      setError(hourlyRateCheck.error)
      return
    }

    // Cor pela metade não pode chegar à API: ela responde 400 e a mensagem
    // genérica não diria QUAL das cinco está incompleta.
    const corInvalida = CAMPOS_DE_COR.find((campo) => !isHexColor(colors[campo.key]))
    if (corInvalida) {
      setError(`Informe ${corInvalida.label.toLowerCase()} no formato #RRGGBB.`)
      return
    }

    setError(null)
    try {
      await updateParameters.mutateAsync({
        ...colors,
        // Sem `|| algo`: vazio aqui é o pedido de "só a logo, sem texto".
        headerTitle: headerTitle.trim(),
        companyName: companyName.trim(),
        companyAddress: companyAddress.trim(),
        monthlyHoursAllowance: monthlyHoursAllowance.trim(),
        activityHourlyRate: activityHourlyRate.trim(),
        hoursBankClosingDate,
      })
      // O cabeçalho lê a marca por uma consulta própria; sem invalidá-la, quem
      // acabou de trocar o título continuaria vendo o antigo ao lado da logo.
      refreshHeaderTitle()
      toast.show('Parâmetros atualizados.', 'success')
    } catch (caught) {
      setError(toMessage(caught))
    }
  }

  function handleUpload(variant: LogoVariant, selected: SelectedImage) {
    setLogoBusy((current) => ({ ...current, [variant]: true }))
    const mutation =
      variant === 'dark' ? uploadDarkLogo : variant === 'report' ? uploadReportLogo : uploadLogo
    mutation.mutate(
      {
        fileName: selected.fileName,
        contentType: selected.contentType,
        dataBase64: selected.dataBase64,
      },
      {
        onSuccess: () => {
          // Fura o cache do navegador: a URL é a mesma, o conteúdo não.
          const nextUrl =
            variant === 'report'
              ? cacheBustedLogoUrl(publicReportLogoUrl)
              : refreshCompanyLogo(variant)
          setLogoUrls((current) => ({ ...current, [variant]: nextUrl }))
          toast.show(
            variant === 'dark'
              ? 'Logo do sistema (modo escuro) atualizada.'
              : variant === 'report'
                ? 'Logo da empresa atualizada.'
                : 'Logo do sistema (modo claro) atualizada.',
            'success'
          )
        },
        onError: (caught) => toast.show(toMessage(caught), 'error'),
        onSettled: () => setLogoBusy((current) => ({ ...current, [variant]: false })),
      }
    )
  }

  function confirmRemove() {
    const variant = pendingRemove
    if (!variant) return
    setPendingRemove(null)
    const mutation =
      variant === 'dark' ? removeDarkLogo : variant === 'report' ? removeReportLogo : removeLogo
    mutation.mutate(undefined, {
      onSuccess: () => {
        setLogoUrls((current) => ({ ...current, [variant]: null }))
        if (variant !== 'report') refreshCompanyLogo(variant)
        toast.show(
          variant === 'dark'
            ? 'Logo do sistema (modo escuro) removida.'
            : variant === 'report'
              ? 'Logo da empresa removida.'
              : 'Logo do sistema (modo claro) removida.',
          'success'
        )
      },
      onError: (caught) => toast.show(toMessage(caught), 'error'),
    })
  }

  if (parameters.isError && !parameters.data) {
    return (
      <AppShell title="Parâmetros">
        <Card>
          <ErrorState error={parameters.error} onRetry={() => void parameters.refetch()} />
        </Card>
      </AppShell>
    )
  }

  if (!parameters.data) {
    return (
      <AppShell title="Parâmetros da empresa">
        <Card>
          <Skeleton height={140} radius={12} />
        </Card>
      </AppShell>
    )
  }

  return (
    <AppShell title="Parâmetros da empresa">
      <Card>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Cabeçalho dos relatórios
        </Text>
        <Input
          label="Nome da empresa"
          value={companyName}
          onChangeText={setCompanyName}
          disabled={updateParameters.isPending}
        />
        <Input
          label="Endereço"
          value={companyAddress}
          onChangeText={setCompanyAddress}
          multiline
          rows={2}
          disabled={updateParameters.isPending}
        />
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Identidade visual</Text>
        <LogoField
          label="Logo do sistema (modo claro)"
          currentUrl={logoUrls.light}
          previewBackgroundColor="#ffffff"
          onUpload={
            Platform.OS === 'web' ? (selected) => handleUpload('light', selected) : undefined
          }
          onRemove={() => setPendingRemove('light')}
          busy={logoBusy.light}
          removeBusy={removeLogo.isPending}
        />
        <View style={[styles.logoDivider, { backgroundColor: theme.border }]} />
        <LogoField
          label="Logo do sistema (modo escuro)"
          currentUrl={logoUrls.dark}
          previewBackgroundColor="#111827"
          onUpload={
            Platform.OS === 'web' ? (selected) => handleUpload('dark', selected) : undefined
          }
          onRemove={() => setPendingRemove('dark')}
          busy={logoBusy.dark}
          removeBusy={removeDarkLogo.isPending}
        />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          O sistema alterna automaticamente entre as versões conforme o tema ativo. PNG, JPEG,
          WebP, GIF ou SVG, até 1MB.
        </Text>

        <View style={[styles.logoDivider, { backgroundColor: theme.border }]} />

        <Text style={[styles.subsectionTitle, { color: theme.textPrimary }]}>Relatórios PDF</Text>
        <LogoField
          label="Logo da empresa"
          currentUrl={logoUrls.report}
          previewBackgroundColor="#ffffff"
          onUpload={
            Platform.OS === 'web' ? (selected) => handleUpload('report', selected) : undefined
          }
          onRemove={() => setPendingRemove('report')}
          busy={logoBusy.report}
          removeBusy={removeReportLogo.isPending}
        />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Usada no cabeçalho dos relatórios PDF. Ela não altera as logos do sistema.
        </Text>

        <View style={[styles.logoDivider, { backgroundColor: theme.border }]} />

        <Input
          label="Título ao lado da logo"
          value={headerTitle}
          onChangeText={setHeaderTitle}
          hint="Aparece no cabeçalho e na coluna de navegação. Deixe em branco para exibir só a logo."
          maxLength={60}
          disabled={updateParameters.isPending}
        />
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Identidade visual
        </Text>
        <Text style={[styles.hint, styles.sectionHint, { color: theme.textSecondary }]}>
          As mesmas cores valem para a interface e para o cabeçalho dos relatórios em PDF. Os
          tons neutros do papel (texto, filete, linhas zebradas) não mudam: eles é que garantem
          o contraste da leitura.
        </Text>
        {CAMPOS_DE_COR.map((campo) => (
          <ColorField
            key={campo.key}
            label={campo.label}
            hint={campo.hint}
            value={colors[campo.key]}
            onChange={(value) => setColors((atual) => ({ ...atual, [campo.key]: value }))}
            disabled={updateParameters.isPending}
          />
        ))}
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Banco de horas</Text>
        <View style={[styles.billingFields, isMobile && styles.billingFieldsMobile]}>
          <View style={!isMobile ? styles.billingField : undefined}>
            <Input
              label="Franquia mensal (h)"
              value={monthlyHoursAllowance}
              onChangeText={setMonthlyHoursAllowance}
              keyboardType="numeric"
              hint="Horas incluídas por mês. Aceita vírgula decimal."
              disabled={updateParameters.isPending}
            />
          </View>
          <View style={!isMobile ? styles.billingField : undefined}>
            <Input
              label="Valor da hora (R$)"
              value={activityHourlyRate}
              onChangeText={setActivityHourlyRate}
              keyboardType="numeric"
              hint="Usado no total devido do relatório de atividades."
              disabled={updateParameters.isPending}
            />
          </View>
        </View>
        <DateField
          label="Data de fechamento"
          value={hoursBankClosingDate}
          onChange={setHoursBankClosingDate}
          hint="Define o início do ciclo semestral do banco de horas."
          disabled={updateParameters.isPending}
        />

        {error && (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
            {error}
          </Text>
        )}

        <View style={styles.actions}>
          <Button
            title="Salvar"
            onPress={() => void handleSave()}
            loading={updateParameters.isPending}
          />
        </View>
      </Card>

      <ConfirmationDialog
        visible={pendingRemove !== null}
        title={
          pendingRemove === 'report'
            ? 'Remover a logo da empresa?'
            : `Remover a logo do sistema (modo ${pendingRemove === 'dark' ? 'escuro' : 'claro'})?`
        }
        description={
          pendingRemove === 'dark'
            ? 'A interface escura voltará a exibir a marca padrão.'
            : pendingRemove === 'report'
              ? 'Os relatórios PDF deixarão de exibir a logo da empresa.'
              : 'A interface clara voltará a exibir a marca padrão.'
        }
        confirmLabel="Remover"
        destructive
        busy={removeLogo.isPending || removeDarkLogo.isPending || removeReportLogo.isPending}
        onCancel={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
      />
    </AppShell>
  )
}

const styles = StyleSheet.create({
  sectionHint: { marginTop: -8, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  subsectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  hint: { fontSize: 13, marginTop: 10 },
  logoDivider: { height: 1, marginVertical: 18 },
  billingFields: { flexDirection: 'row', gap: 16 },
  billingFieldsMobile: { flexDirection: 'column', gap: 0 },
  billingField: { flex: 1, minWidth: 0 },
  error: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
})
