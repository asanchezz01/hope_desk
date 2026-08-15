import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { toMessage } from '../../src/api/to-message'
import Button from '../../src/components/Button'
import Card from '../../src/components/Card'
import DateField from '../../src/components/DateField'
import EmptyState from '../../src/components/EmptyState'
import ErrorState from '../../src/components/ErrorState'
import Input from '../../src/components/Input'
import Skeleton from '../../src/components/Skeleton'
import { useToast } from '../../src/components/Toast'
import { useAuth } from '../../src/context/AuthProvider'
import { validateDecimalInput } from '../../src/domain/decimal-input'
import { useCompanyParameters, useUpdateCompanyParameters } from '../../src/hooks/useAdmin'
import AppShell from '../../src/layout/AppShell'
import { navItemsFor } from '../../src/layout/nav-items'
import { useTheme } from '../../src/theme/ThemeContext'

export default function AdminParameters() {
  const theme = useTheme()
  const toast = useToast()
  const { user, isSuperuser } = useAuth()

  const parameters = useCompanyParameters(isSuperuser)
  const updateParameters = useUpdateCompanyParameters()

  const [companyName, setCompanyName] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyLogo, setCompanyLogo] = useState('')
  const [monthlyHoursAllowance, setMonthlyHoursAllowance] = useState('')
  const [hoursBankClosingDate, setHoursBankClosingDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loaded = parameters.data !== undefined
  useEffect(() => {
    const data = parameters.data
    if (!data) return
    setCompanyName(data.companyName)
    setCompanyAddress(data.companyAddress)
    setCompanyLogo(data.companyLogo)
    setMonthlyHoursAllowance(data.monthlyHoursAllowance)
    setHoursBankClosingDate(data.hoursBankClosingDate)
  }, [loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isSuperuser) {
    return (
      <AppShell title="Parâmetros" navItems={navItemsFor(user)}>
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
        companyLogo: companyLogo.trim(),
        monthlyHoursAllowance: monthlyHoursAllowance.trim(),
        hoursBankClosingDate,
      })
      toast.show('Parâmetros atualizados.', 'success')
    } catch (caught) {
      setError(toMessage(caught))
    }
  }

  if (parameters.isError && !parameters.data) {
    return (
      <AppShell title="Parâmetros" navItems={navItemsFor(user)}>
        <Card>
          <ErrorState error={parameters.error} onRetry={() => void parameters.refetch()} />
        </Card>
      </AppShell>
    )
  }

  if (!parameters.data) {
    return (
      <AppShell title="Parâmetros" navItems={navItemsFor(user)}>
        <Card>
          <Skeleton height={140} radius={12} />
        </Card>
      </AppShell>
    )
  }

  return (
    <AppShell title="Parâmetros da empresa" navItems={navItemsFor(user)}>
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
        <Input
          label="Logo"
          value={companyLogo}
          onChangeText={setCompanyLogo}
          autoCapitalize="none"
          // O legado buscava a URL dentro do request que gerava o PDF — um SSRF.
          // A API ignora URLs remotas com aviso em log e segue lendo caminhos
          // locais; dizer isso aqui evita configurar algo que não terá efeito.
          hint="URLs remotas são ignoradas na geração do PDF por segurança. Use um caminho local."
          disabled={updateParameters.isPending}
        />
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
    </AppShell>
  )
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  error: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
})
