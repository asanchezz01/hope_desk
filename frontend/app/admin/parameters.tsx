import React, { useEffect, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'

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
import { useCompanyLogo } from '../../src/hooks/useCompanyLogo'
import AppShell from '../../src/layout/AppShell'
import { navItemsFor } from '../../src/layout/nav-items'
import { useTheme } from '../../src/theme/ThemeContext'

export default function AdminParameters() {
  const theme = useTheme()
  const toast = useToast()
  const { user, isSuperuser } = useAuth()

  const parameters = useCompanyParameters(isSuperuser)
  const updateParameters = useUpdateCompanyParameters()
  const uploadLogo = useUploadCompanyLogo()
  const removeLogo = useRemoveCompanyLogo()
  const publicLogoUrl = useCompanyLogo()
  const [logoUrl, setLogoUrl] = useState<string | null>(publicLogoUrl)
  const [logoBusy, setLogoBusy] = useState(false)
  const [pendingRemove, setPendingRemove] = useState(false)

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
  }, [loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // A URL pública resolve de forma assíncrona; quando chegar, reflete na prévia.
  useEffect(() => {
    if (publicLogoUrl) setLogoUrl(publicLogoUrl)
  }, [publicLogoUrl])

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

  function handleUpload(selected: SelectedImage) {
    setLogoBusy(true)
    uploadLogo.mutate(
      {
        fileName: selected.fileName,
        contentType: selected.contentType,
        dataBase64: selected.dataBase64,
      },
      {
        onSuccess: (result) => {
          setLogoUrl(result.companyLogo)
          toast.show('Logo da empresa atualizada.', 'success')
        },
        onError: (caught) => toast.show(toMessage(caught), 'error'),
        onSettled: () => setLogoBusy(false),
      }
    )
  }

  function confirmRemove() {
    setPendingRemove(false)
    removeLogo.mutate(undefined, {
      onSuccess: () => {
        setLogoUrl(null)
        toast.show('Logo da empresa removida.', 'success')
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
          currentUrl={logoUrl}
          onUpload={Platform.OS === 'web' ? handleUpload : undefined}
          onRemove={() => setPendingRemove(true)}
          busy={logoBusy}
          removeBusy={removeLogo.isPending}
        />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          PNG, JPEG, WebP, GIF ou SVG, até 1MB. Aparece na tela de login, no cabeçalho do aplicativo
          e no cabeçalho do PDF.
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
        visible={pendingRemove}
        title="Remover a logo da empresa?"
        description="A logo atual sai da tela de login, do cabeçalho e do PDF."
        confirmLabel="Remover"
        destructive
        busy={removeLogo.isPending}
        onCancel={() => setPendingRemove(false)}
        onConfirm={confirmRemove}
      />
    </AppShell>
  )
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  hint: { fontSize: 13, marginTop: 10 },
  error: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
})
