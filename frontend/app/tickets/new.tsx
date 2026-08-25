import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { SystemModuleOption } from '../../src/api/catalog'
import type { ApiUser } from '../../src/api/client'
import { toMessage } from '../../src/api/to-message'
import Button from '../../src/components/Button'
import Card from '../../src/components/Card'
import ErrorState from '../../src/components/ErrorState'
import Input from '../../src/components/Input'
import Select from '../../src/components/Select'
import { useToast } from '../../src/components/Toast'
import { useAuth } from '../../src/context/AuthProvider'
import { canCreateForOtherClient } from '../../src/domain/ticket-permissions'
import { useActiveModules, useClients, useTechnicians } from '../../src/hooks/useCatalog'
import { useCreateTicket } from '../../src/hooks/useTickets'
import AppShell from '../../src/layout/AppShell'
import { useTheme } from '../../src/theme/ThemeContext'

export default function NewTicket() {
  const theme = useTheme()
  const router = useRouter()
  const toast = useToast()
  const { user } = useAuth()

  const modules = useActiveModules()
  const clients = useClients()
  const technicians = useTechnicians()
  const createTicket = useCreateTicket()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [systemModuleId, setSystemModuleId] = useState<number | null>(null)
  const [clientId, setClientId] = useState<number | null>(null)
  const [technicianId, setTechnicianId] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Cliente abre chamado só para si — `new_ticket` no legado tem apenas
  // `@login_required`, e a API ignora em silêncio qualquer `clientId` enviado
  // por cliente. Técnico e superuser precisam escolher para quem.
  const choosesClient = user !== null && canCreateForOtherClient(user)

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!title.trim() || !description.trim()) {
      if (!title.trim()) next.title = 'Título e descrição são obrigatórios.'
      if (!description.trim()) next.description = 'Título e descrição são obrigatórios.'
    }
    if (!systemModuleId) next.systemModuleId = 'Módulo inválido.'
    if (choosesClient && !clientId) next.clientId = 'Cliente inválido.'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit() {
    if (createTicket.isPending) return
    if (!validate()) return

    setSubmitError(null)
    try {
      const ticket = await createTicket.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        systemModuleId: systemModuleId as number,
        ...(choosesClient && clientId ? { clientId } : {}),
        ...(technicianId ? { technicianId } : {}),
      })
      toast.show(`Chamado #${ticket.id} aberto.`, 'success')
      router.replace(`/tickets/${ticket.id}`)
    } catch (caught) {
      setSubmitError(toMessage(caught))
    }
  }

  if (modules.isError) {
    return (
      <AppShell title="Novo chamado" width="form">
        <ErrorState error={modules.error} onRetry={() => void modules.refetch()} />
      </AppShell>
    )
  }

  // Anotado porque `data ?? []` gera uma união de tipos de array, sobre a qual
  // o TypeScript não consegue resolver a assinatura de `.map`.
  const moduleList: SystemModuleOption[] = modules.data ?? []
  const clientList: ApiUser[] = clients.data ?? []
  const technicianList: ApiUser[] = technicians.data ?? []

  const moduleOptions = moduleList.map((item) => ({ value: item.id, label: item.name }))

  return (
    <AppShell title="Novo chamado" width="form">
      <Card>
        <Input
          label="Título"
          placeholder="Resumo do problema"
          value={title}
          onChangeText={setTitle}
          error={errors.title}
          maxLength={200}
          disabled={createTicket.isPending}
        />

        <Input
          label="Descrição"
          placeholder="Descreva o que está acontecendo"
          value={description}
          onChangeText={setDescription}
          error={errors.description}
          multiline
          rows={6}
          maxLength={20000}
          disabled={createTicket.isPending}
        />

        <Select
          label="Módulo"
          value={systemModuleId}
          options={moduleOptions}
          onChange={setSystemModuleId}
          error={errors.systemModuleId}
          placeholder={modules.isLoading ? 'Carregando módulos…' : 'Selecione o módulo'}
          disabled={createTicket.isPending || modules.isLoading}
          // Abrir chamado exige módulo ATIVO — a lista já vem filtrada pela API.
          emptyMessage="Nenhum módulo ativo. Peça a um superuser para ativar um módulo."
        />

        {choosesClient && (
          <Select
            label="Cliente"
            value={clientId}
            options={clientList.map((item) => ({
              value: item.id,
              label: item.name,
              hint: item.email,
            }))}
            onChange={setClientId}
            error={errors.clientId}
            placeholder={clients.isLoading ? 'Carregando clientes…' : 'Selecione o cliente'}
            disabled={createTicket.isPending || clients.isLoading}
          />
        )}

        {choosesClient && (
          <Select
            label="Técnico responsável (opcional)"
            value={technicianId}
            options={technicianList.map((item) => ({
              value: item.id,
              label: item.name,
              hint: item.email,
            }))}
            onChange={setTechnicianId}
            placeholder="Sem técnico designado"
            disabled={createTicket.isPending || technicians.isLoading}
          />
        )}

        {!choosesClient && (
          <Text style={[styles.note, { color: theme.muted }]}>
            O chamado será aberto em seu nome. Um técnico será designado pela equipe.
          </Text>
        )}

        {submitError && (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
            {submitError}
          </Text>
        )}

        <View style={styles.actions}>
          <Button
            title="Cancelar"
            variant="secondary"
            onPress={() => router.back()}
            disabled={createTicket.isPending}
          />
          <Button
            title="Abrir chamado"
            onPress={() => void handleSubmit()}
            loading={createTicket.isPending}
          />
        </View>
      </Card>
    </AppShell>
  )
}

const styles = StyleSheet.create({
  note: { fontSize: 12, lineHeight: 18, marginBottom: 8 },
  error: { marginBottom: 12, fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
})
