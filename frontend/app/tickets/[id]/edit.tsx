import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { SystemModuleOption } from '../../../src/api/catalog'
import type { ApiUser } from '../../../src/api/client'
import { TICKET_STATUS_FILTER_LABELS, type TicketStatus } from '../../../src/api/tickets'
import { toMessage } from '../../../src/api/to-message'
import Button from '../../../src/components/Button'
import Card from '../../../src/components/Card'
import EmptyState from '../../../src/components/EmptyState'
import ErrorState from '../../../src/components/ErrorState'
import Input from '../../../src/components/Input'
import Select from '../../../src/components/Select'
import Skeleton from '../../../src/components/Skeleton'
import { useToast } from '../../../src/components/Toast'
import { useAuth } from '../../../src/context/AuthProvider'
import { canEditTicket } from '../../../src/domain/ticket-permissions'
import { TICKET_STATUSES } from '../../../src/domain/ticket-status'
import { useActiveModules, useClients, useTechnicians } from '../../../src/hooks/useCatalog'
import { useTicket, useUpdateTicket } from '../../../src/hooks/useTickets'
import AppShell from '../../../src/layout/AppShell'
import { navItemsFor } from '../../../src/layout/nav-items'
import { useTheme } from '../../../src/theme/ThemeContext'

/** Valor do Select para "sem técnico designado" — a API recebe `null`. */
const NO_TECHNICIAN = 0

export default function EditTicket() {
  const theme = useTheme()
  const router = useRouter()
  const toast = useToast()
  const { user } = useAuth()
  const params = useLocalSearchParams<{ id: string }>()

  const ticketId = Number(params.id)
  const validId = Number.isInteger(ticketId) && ticketId > 0

  const ticket = useTicket(validId ? ticketId : null)
  const modules = useActiveModules()
  const clients = useClients()
  const technicians = useTechnicians()
  const updateTicket = useUpdateTicket(ticketId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TicketStatus>('aberto')
  const [clientId, setClientId] = useState<number | null>(null)
  const [systemModuleId, setSystemModuleId] = useState<number | null>(null)
  const [technicianId, setTechnicianId] = useState<number>(NO_TECHNICIAN)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Preenche uma única vez, quando o chamado chega. Um `useEffect` dependente
  // do objeto inteiro sobrescreveria o que o usuário digitou a cada refetch.
  const loadedId = ticket.data?.id
  useEffect(() => {
    const data = ticket.data
    if (!data) return
    setTitle(data.title)
    setDescription(data.description)
    setStatus(data.status)
    setClientId(data.client.id)
    setSystemModuleId(data.systemModule?.id ?? null)
    setTechnicianId(data.technician?.id ?? NO_TECHNICIAN)
  }, [loadedId]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * A edição aceita módulo INATIVO — o legado não filtra por `is_active` aqui,
   * para não travar chamados antigos ligados a um módulo desativado. Como
   * `/system-modules/active` só devolve os ativos, o módulo atual do chamado é
   * acrescentado à lista quando não estiver nela.
   */
  const moduleOptions = useMemo(() => {
    // Anotado porque `data ?? []` gera uma união de tipos de array, sobre a
    // qual o TypeScript não resolve a assinatura de `.map`.
    const modulesData: SystemModuleOption[] = modules.data ?? []
    const active = modulesData.map((item) => ({ value: item.id, label: item.name }))
    const current = ticket.data?.systemModule
    if (current && !active.some((option) => option.value === current.id)) {
      return [...active, { value: current.id, label: `${current.name} (inativo)` }]
    }
    return active
  }, [modules.data, ticket.data?.systemModule])

  if (!validId) {
    return (
      <AppShell title="Editar chamado" navItems={navItemsFor(user)} width="form">
        <EmptyState
          title="Chamado inválido"
          description="O endereço acessado não corresponde a um chamado."
          actionLabel="Ver chamados"
          onAction={() => router.replace('/')}
        />
      </AppShell>
    )
  }

  if (user && !canEditTicket(user)) {
    // Esconder a tela é conveniência; a API recusaria o PATCH de qualquer forma.
    return (
      <AppShell title="Editar chamado" navItems={navItemsFor(user)} width="form">
        <EmptyState
          title="Sem permissão"
          description="Apenas técnicos podem editar chamados."
          actionLabel="Voltar ao chamado"
          onAction={() => router.replace(`/tickets/${ticketId}`)}
        />
      </AppShell>
    )
  }

  if (ticket.isLoading) {
    return (
      <AppShell title="Editar chamado" navItems={navItemsFor(user)} width="form">
        <Card>
          <Skeleton height={20} width="50%" />
          <View style={styles.gap} />
          <Skeleton height={16} />
        </Card>
      </AppShell>
    )
  }

  if (ticket.isError || !ticket.data) {
    return (
      <AppShell title="Editar chamado" navItems={navItemsFor(user)} width="form">
        <ErrorState error={ticket.error} onRetry={() => void ticket.refetch()} />
      </AppShell>
    )
  }

  const clientList: ApiUser[] = clients.data ?? []
  const technicianList: ApiUser[] = technicians.data ?? []

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!title.trim()) next.title = 'Título e descrição são obrigatórios.'
    if (!description.trim()) next.description = 'Título e descrição são obrigatórios.'
    if (!systemModuleId) next.systemModuleId = 'Módulo inválido.'
    if (!clientId) next.clientId = 'Cliente inválido.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit() {
    if (updateTicket.isPending) return
    if (!validate()) return

    setSubmitError(null)
    try {
      await updateTicket.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        status,
        clientId: clientId as number,
        systemModuleId: systemModuleId as number,
        // `null` desatribui explicitamente; omitir manteria o técnico atual.
        technicianId: technicianId === NO_TECHNICIAN ? null : technicianId,
      })
      toast.show('Chamado atualizado.', 'success')
      router.replace(`/tickets/${ticketId}`)
    } catch (caught) {
      setSubmitError(toMessage(caught))
    }
  }

  return (
    <AppShell title={`Editar chamado #${ticketId}`} navItems={navItemsFor(user)} width="form">
      <Card>
        <Input
          label="Título"
          value={title}
          onChangeText={setTitle}
          error={errors.title}
          maxLength={200}
          disabled={updateTicket.isPending}
        />

        <Input
          label="Descrição"
          value={description}
          onChangeText={setDescription}
          error={errors.description}
          multiline
          rows={6}
          maxLength={20000}
          disabled={updateTicket.isPending}
        />

        <Select
          label="Situação"
          value={status}
          options={TICKET_STATUSES.map((value) => ({
            value,
            label: TICKET_STATUS_FILTER_LABELS[value],
          }))}
          onChange={setStatus}
          disabled={updateTicket.isPending}
        />

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
          disabled={updateTicket.isPending || clients.isLoading}
        />

        <Select
          label="Módulo"
          value={systemModuleId}
          options={moduleOptions}
          onChange={setSystemModuleId}
          error={errors.systemModuleId}
          placeholder={modules.isLoading ? 'Carregando módulos…' : 'Selecione o módulo'}
          disabled={updateTicket.isPending || modules.isLoading}
        />

        <Select
          label="Técnico responsável"
          value={technicianId}
          options={[
            { value: NO_TECHNICIAN, label: 'Sem técnico designado' },
            ...technicianList.map((item) => ({
              value: item.id,
              label: item.name,
              hint: item.email,
            })),
          ]}
          onChange={setTechnicianId}
          disabled={updateTicket.isPending || technicians.isLoading}
        />

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
            disabled={updateTicket.isPending}
          />
          <Button
            title="Salvar"
            onPress={() => void handleSubmit()}
            loading={updateTicket.isPending}
          />
        </View>
      </Card>
    </AppShell>
  )
}

const styles = StyleSheet.create({
  gap: { height: 10 },
  error: { marginBottom: 12, fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
})
