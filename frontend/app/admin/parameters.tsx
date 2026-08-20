import React, { useEffect, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'

import { publicDarkLogoUrl, publicLogoUrl } from '../../src/api/admin'
import { toMessage } from '../../src/api/to-message'
import Button from '../../src/components/Button'
import Card from '../../src/components/Card'
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
import { validateDecimalInput } from '../../src/domain/decimal-input'
import {
  useCompanyParameters,
  useRemoveCompanyLogo,
  useUpdateCompanyParameters,
  useUploadCompanyLogo,
} from '../../src/hooks/useAdmin'
import { refreshCompanyLogo } from '../../src/hooks/useCompanyLogo'
import AppShell from '../../src/layout/AppShell'
import { navItemsFor } from '../../src/layout/nav-items'
import { useTheme } from '../../src/theme/ThemeContext'

type LogoVariant = 'light' | 'dark'

export default function AdminParameters() {
  const theme = useTheme()
  const toast = useToast()
  const { user, isSuperuser } = useAuth()

  const parameters = useCompanyParameters(isSuperuser)
  const updateParameters = useUpdateCompanyParameters()
  const uploadLogo = useUploadCompanyLogo('light')
  const uploadDarkLogo = useUploadCompanyLogo('dark')
  const removeLogo = useRemoveCompanyLogo('light')
  const removeDarkLogo = useRemoveCompanyLogo('dark')
  const [logoUrls, setLogoUrls] = useState<Record<LogoVariant, string | null>>({
    light: null,
    dark: null,
  })
  const [logoBusy, setLogoBusy] = useState<Record<LogoVariant, boolean>>({
    light: false,
    dark: false,
  })
  const [pendingRemove, setPendingRemove] = useState<LogoVariant | null>(null)

  const [companyName, setCompanyName] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [monthlyHoursAllowance, setMonthlyHoursAllowance] = useState('')
  const [hoursBankClosingDate, setHoursBankClosingDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loaded = parameters.data !== undefined
  useEffect(() => {
    const data = parameters.data
    if (!data) return
    setCompanyName(data.companyName)
    setCompanyAddress(data.companyAddress)
    setMonthlyHoursAllowance(data.monthlyHoursAllowance)
    setHoursBankClosingDate(data.hoursBankClosingDate)
    // `companyLogo` é o arquivo gravado (vazio = sem logo); é ele quem diz se a
    // prévia mostra a imagem ou o "sem logo".
    setLogoUrls({
      light: data.companyLogo ? publicLogoUrl : null,
      dark: data.companyLogoDark ? publicDarkLogoUrl : null,
    })
  }, [loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isSuperuser) {
    return (
      <AppShell title="Parâmetros" navItems={navItemsFor(user)} width="form">
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

    setError(null)
    try {
      await updateParameters.mutateAsync({
        companyName: companyName.trim(),
        companyAddress: companyAddress.trim(),
        monthlyHoursAllowance: monthlyHoursAllowance.trim(),
        hoursBankClosingDate,
      })
      toast.show('Parâmetros atualizados.', 'success')
    } catch (caught) {
      setError(toMessage(caught))
    }
  }

  function handleUpload(variant: LogoVariant, selected: SelectedImage) {
    setLogoBusy((current) => ({ ...current, [variant]: true }))
    const mutation = variant === 'dark' ? uploadDarkLogo : uploadLogo
    mutation.mutate(
      {
        fileName: selected.fileName,
        contentType: selected.contentType,
        dataBase64: selected.dataBase64,
      },
      {
        onSuccess: () => {
          // Fura o cache do navegador: a URL é a mesma, o conteúdo não.
          const nextUrl = refreshCompanyLogo(variant)
          setLogoUrls((current) => ({ ...current, [variant]: nextUrl }))
          toast.show(
            variant === 'dark'
              ? 'Logo do modo escuro atualizada.'
              : 'Logo do modo claro atualizada.',
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
    const mutation = variant === 'dark' ? removeDarkLogo : removeLogo
    mutation.mutate(undefined, {
      onSuccess: () => {
        setLogoUrls((current) => ({ ...current, [variant]: null }))
        refreshCompanyLogo(variant)
        toast.show(
          variant === 'dark' ? 'Logo do modo escuro removida.' : 'Logo do modo claro removida.',
          'success'
        )
      },
      onError: (caught) => toast.show(toMessage(caught), 'error'),
    })
  }

  if (parameters.isError && !parameters.data) {
    return (
      <AppShell title="Parâmetros" navItems={navItemsFor(user)} width="form">
        <Card>
          <ErrorState error={parameters.error} onRetry={() => void parameters.refetch()} />
        </Card>
      </AppShell>
    )
  }

  if (!parameters.data) {
    return (
      <AppShell title="Parâmetros da empresa" navItems={navItemsFor(user)} width="form">
        <Card>
          <Skeleton height={140} radius={12} />
        </Card>
      </AppShell>
    )
  }

  return (
    <AppShell title="Parâmetros da empresa" navItems={navItemsFor(user)} width="form">
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
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Logo da empresa</Text>
        <LogoField
          label="Modo claro e relatórios"
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
          label="Modo escuro"
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
          PNG, JPEG, WebP, GIF ou SVG, até 1MB. Aparece na tela de login, no cabeçalho do aplicativo
          e no cabeçalho do PDF. A versão clara também é usada nos relatórios.
        </Text>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Banco de horas</Text>
        <Input
          label="Franquia mensal de horas"
          value={monthlyHoursAllowance}
          onChangeText={setMonthlyHoursAllowance}
          keyboardType="numeric"
          hint="Aceita vírgula decimal. Não use separador de milhar."
          disabled={updateParameters.isPending}
        />
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
        title={`Remover a logo do modo ${pendingRemove === 'dark' ? 'escuro' : 'claro'}?`}
        description={
          pendingRemove === 'dark'
            ? 'A interface escura voltará a exibir a marca padrão.'
            : 'A interface clara e os PDFs voltarão a exibir a marca padrão.'
        }
        confirmLabel="Remover"
        destructive
        busy={removeLogo.isPending || removeDarkLogo.isPending}
        onCancel={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
      />
    </AppShell>
  )
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  hint: { fontSize: 13, marginTop: 10 },
  logoDivider: { height: 1, marginVertical: 18 },
  error: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
})
