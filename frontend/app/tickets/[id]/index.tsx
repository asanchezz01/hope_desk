import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { Activity } from '../../../src/api/activities'
import { TICKET_STATUS_FILTER_LABELS, type TicketStatus } from '../../../src/api/tickets'
import { toMessage } from '../../../src/api/to-message'
import ActivityForm from '../../../src/components/ActivityForm'
import Button from '../../../src/components/Button'
import Card from '../../../src/components/Card'
import ConfirmationDialog from '../../../src/components/ConfirmationDialog'
import EmptyState from '../../../src/components/EmptyState'
import ErrorState from '../../../src/components/ErrorState'
import Select from '../../../src/components/Select'
import Skeleton from '../../../src/components/Skeleton'
import StatusBadge from '../../../src/components/StatusBadge'
import { useToast } from '../../../src/components/Toast'
import { useAuth } from '../../../src/context/AuthProvider'
import {
  canChangeTicketStatus,
  canCreateActivity,
  canDeleteTicket,
  canEditTicket,
  TICKET_DELETE_WINDOW_MESSAGE,
} from '../../../src/domain/ticket-permissions'
import { TICKET_STATUSES } from '../../../src/domain/ticket-status'
import { formatInstantLabel } from '../../../src/domain/wall-clock'
import {
  useActivities,
  useCreateActivity,
  useDeleteActivity,
  useUpdateActivity,
} from '../../../src/hooks/useActivities'
import { useChangeTicketStatus, useDeleteTicket, useTicket } from '../../../src/hooks/useTickets'
import AppShell from '../../../src/layout/AppShell'
import { navItemsFor } from '../../../src/layout/nav-items'
import { useBreakpoint } from '../../../src/layout/useBreakpoint'
import { useTheme } from '../../../src/theme/ThemeContext'

export default function TicketDetail() {
  const theme = useTheme()
  const router = useRouter()
  const toast = useToast()
  const { user } = useAuth()
  // O mesmo limiar da grade de chamados (1180), e não o de desktop (1024): a
  // 1024 as duas colunas encolhem abaixo do que o cartão de detalhe comporta.
  const twoColumns = useBreakpoint().gridColumns > 1
  const params = useLocalSearchParams<{ id: string }>()

  const ticketId = Number(params.id)
  const validId = Number.isInteger(ticketId) && ticketId > 0

  const ticket = useTicket(validId ? ticketId : null)
  const activities = useActivities(validId ? ticketId : null)

  const changeStatus = useChangeTicketStatus(ticketId)
  const deleteTicket = useDeleteTicket()
  const createActivity = useCreateActivity(ticketId)
  const updateActivity = useUpdateActivity(ticketId)
  const deleteActivity = useDeleteActivity(ticketId)

  const [confirmDeleteTicket, setConfirmDeleteTicket] = useState(false)
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [showActivityForm, setShowActivityForm] = useState(false)

  const canEdit = user !== null && canEditTicket(user)
  const canChange = user !== null && canChangeTicketStatus(user)
  const canAddActivity = user !== null && canCreateActivity(user)
  const canDelete = user !== null && ticket.data !== undefined && canDeleteTicket(user, ticket.data)

  // Linha do tempo: abertura do chamado + atividades, em ordem cronológica.
  // Note que as duas datas vivem em espaços temporais diferentes — o chamado em
  // instante UTC e as atividades em hora de parede — então a ordenação usa os
  // rótulos já resolvidos por cada origem, e não uma comparação entre elas.
  const timeline = useMemo(() => {
    // Anotado: `?? []` produziria uma união de tipos de array e o parâmetro
    // de `.map` cairia em `any` implícito.
    const rows: Activity[] = activities.data?.items ?? []
    const items = rows.map((activity) => ({
      key: `activity-${activity.id}`,
      title: activity.notes,
      when: `${activity.startedLabel} — ${activity.endedLabel}`,
      author: activity.createdBy.name,
      duration: activity.durationHours,
      activity,
    }))
    return items
  }, [activities.data])

  if (!validId) {
    return (
      <AppShell title="Chamado" navItems={navItemsFor(user)}>
        <EmptyState
          title="Chamado inválido"
          description="O endereço acessado não corresponde a um chamado."
          actionLabel="Ver chamados"
          onAction={() => router.replace('/')}
        />
      </AppShell>
    )
  }

  if (ticket.isLoading) {
    return (
      <AppShell title="Chamado" navItems={navItemsFor(user)}>
        <Card>
          <Skeleton height={22} width="60%" />
          <View style={styles.skeletonGap} />
          <Skeleton height={16} />
          <View style={styles.skeletonGap} />
          <Skeleton height={16} width="80%" />
        </Card>
      </AppShell>
    )
  }

  if (ticket.isError || !ticket.data) {
    // A API devolve 404 (não 403) para chamado de outro cliente, de propósito.
    // A UI segue a mesma linha: nada aqui sugere que o chamado existe.
    return (
      <AppShell title="Chamado" navItems={navItemsFor(user)}>
        <ErrorState error={ticket.error} onRetry={() => void ticket.refetch()} />
      </AppShell>
    )
  }

  const data = ticket.data

  async function handleChangeStatus(status: TicketStatus) {
    if (status === data.status) return
    try {
      await changeStatus.mutateAsync(status)
      toast.show('Situação atualizada.', 'success')
    } catch (caught) {
      toast.show(toMessage(caught), 'error')
    }
  }

  async function handleDeleteTicket() {
    try {
      await deleteTicket.mutateAsync(ticketId)
      setConfirmDeleteTicket(false)
      toast.show('Chamado excluído.', 'success')
      router.replace('/')
    } catch (caught) {
      setConfirmDeleteTicket(false)
      toast.show(toMessage(caught), 'error')
    }
  }

  async function handleDeleteActivity() {
    if (!activityToDelete) return
    try {
      await deleteActivity.mutateAsync(activityToDelete.id)
      setActivityToDelete(null)
      toast.show('Atividade excluída.', 'success')
    } catch (caught) {
      setActivityToDelete(null)
      toast.show(toMessage(caught), 'error')
    }
  }

  return (
    <AppShell title={`Chamado #${data.id}`} navItems={navItemsFor(user)}>
      {/* Em tela larga o detalhe fica à esquerda e as atividades à direita: em
          coluna única a lista de atividades empurrava os dados do chamado para
          fora da tela, e era preciso rolar de volta para conferir o cliente. */}
      <View style={[styles.stack, twoColumns && styles.columns]}>
        <Card style={twoColumns ? styles.columnAside : undefined}>
          <View style={styles.headerRow}>
            <StatusBadge status={data.status} label={data.statusLabel} />
            <Text style={[styles.created, { color: theme.muted }]}>
              Aberto em {formatInstantLabel(data.createdAt)}
            </Text>
          </View>

          <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }]}>
            {data.title}
          </Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {data.description}
          </Text>

          <View style={[styles.facts, { borderTopColor: theme.border }]}>
            <Fact label="Cliente" value={data.client.name} hint={data.client.email} />
            <Fact
              label="Técnico"
              value={data.technician?.name ?? 'Sem técnico designado'}
              hint={data.technician?.email}
            />
            <Fact
              label="Módulo"
              value={data.systemModule?.name ?? '—'}
              hint={
                data.systemModule && !data.systemModule.isActive
                  ? 'Módulo desativado (o chamado segue editável)'
                  : undefined
              }
            />
          </View>

          {canChange && (
            <View style={styles.statusControl}>
              <Select
                label="Alterar situação"
                value={data.status}
                options={TICKET_STATUSES.map((value) => ({
                  value,
                  label: TICKET_STATUS_FILTER_LABELS[value],
                }))}
                onChange={(value) => void handleChangeStatus(value)}
                disabled={changeStatus.isPending}
              />
            </View>
          )}

          <View style={styles.actions}>
            {canEdit && (
              <Button
                title="Editar"
                variant="secondary"
                icon="pen"
                onPress={() => router.push(`/tickets/${data.id}/edit`)}
              />
            )}
            {canDelete && (
              <Button
                title="Excluir"
                variant="danger"
                icon="trash"
                onPress={() => setConfirmDeleteTicket(true)}
              />
            )}
          </View>

          {canEdit && !canDelete && (
            // Explicar por que o botão não está aí evita o suporte receber
            // "sumiu o excluir".
            <Text style={[styles.note, { color: theme.muted }]}>
              {TICKET_DELETE_WINDOW_MESSAGE}
            </Text>
          )}
        </Card>

        <Card style={twoColumns ? styles.columnMain : undefined}>
          <View style={styles.sectionHeader}>
            <Text
              accessibilityRole="header"
              style={[styles.sectionTitle, { color: theme.textPrimary }]}
            >
              Atividades
            </Text>
            {activities.data && activities.data.items.length > 0 && (
              <Text style={[styles.totalHours, { color: theme.textSecondary }]}>
                {activities.data.totalHours.toFixed(2).replace('.', ',')} h no total
              </Text>
            )}
          </View>

          {activities.isLoading && <Skeleton height={60} />}

          {activities.isError && (
            <ErrorState error={activities.error} onRetry={() => void activities.refetch()} />
          )}

          {activities.data && timeline.length === 0 && !showActivityForm && (
            <EmptyState
              title="Nenhuma atividade registrada"
              description={
                canAddActivity
                  ? 'Registre o tempo trabalhado neste chamado.'
                  : 'As atividades aparecerão aqui conforme a equipe registrar o atendimento.'
              }
              actionLabel={canAddActivity ? 'Registrar atividade' : undefined}
              onAction={canAddActivity ? () => setShowActivityForm(true) : undefined}
            />
          )}

          {timeline.map((item) => (
            <View key={item.key} style={[styles.activity, { borderTopColor: theme.border }]}>
              {editingActivity?.id === item.activity.id ? (
                <ActivityForm
                  activity={item.activity}
                  submitting={updateActivity.isPending}
                  onCancel={() => setEditingActivity(null)}
                  onSubmit={async (input) => {
                    await updateActivity.mutateAsync({ id: item.activity.id, input })
                    setEditingActivity(null)
                    toast.show('Atividade atualizada.', 'success')
                  }}
                />
              ) : (
                <>
                  <Text style={[styles.activityNotes, { color: theme.textPrimary }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.activityMeta, { color: theme.muted }]}>
                    {item.when} · {item.duration.toFixed(2).replace('.', ',')} h · {item.author}
                  </Text>
                  <View style={styles.activityActions}>
                    {/* Aqui as dicas vêm do servidor: a regra depende da autoria,
                      e nem superuser edita atividade lançada por outro. */}
                    {item.activity.canEdit && (
                      <Button
                        title="Editar"
                        variant="secondary"
                        icon="pen"
                        onPress={() => setEditingActivity(item.activity)}
                      />
                    )}
                    {item.activity.canDelete && (
                      <Button
                        title="Excluir"
                        variant="danger"
                        icon="trash"
                        onPress={() => setActivityToDelete(item.activity)}
                      />
                    )}
                  </View>
                </>
              )}
            </View>
          ))}

          {canAddActivity && !editingActivity && (
            <View style={[styles.newActivity, { borderTopColor: theme.border }]}>
              {showActivityForm ? (
                <ActivityForm
                  submitting={createActivity.isPending}
                  onCancel={() => setShowActivityForm(false)}
                  onSubmit={async (input) => {
                    await createActivity.mutateAsync(input)
                    toast.show('Atividade registrada.', 'success')
                  }}
                />
              ) : (
                timeline.length > 0 && (
                  // Numa coluna o botão esticaria de ponta a ponta do cartão; a
                  // linha o deixa com a largura do próprio rótulo.
                  <View style={styles.newActivityAction}>
                    <Button
                      title="Registrar atividade"
                      icon="plus"
                      onPress={() => setShowActivityForm(true)}
                    />
                  </View>
                )
              )}
            </View>
          )}
        </Card>
      </View>

      <ConfirmationDialog
        visible={confirmDeleteTicket}
        title={`Excluir o chamado #${data.id}?`}
        description="As atividades registradas serão excluídas junto. Esta ação não pode ser desfeita."
        confirmLabel="Excluir chamado"
        busy={deleteTicket.isPending}
        onCancel={() => setConfirmDeleteTicket(false)}
        onConfirm={() => void handleDeleteTicket()}
      />

      <ConfirmationDialog
        visible={activityToDelete !== null}
        title="Excluir esta atividade?"
        description="O tempo registrado deixará de contar no banco de horas. Esta ação não pode ser desfeita."
        confirmLabel="Excluir atividade"
        busy={deleteActivity.isPending}
        onCancel={() => setActivityToDelete(null)}
        onConfirm={() => void handleDeleteActivity()}
      />
    </AppShell>
  )
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const theme = useTheme()
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: theme.textPrimary }]}>{value}</Text>
      {hint && <Text style={[styles.factHint, { color: theme.muted }]}>{hint}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  skeletonGap: { height: 10 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  created: { fontSize: 12 },
  title: { fontSize: 16, fontWeight: '700', marginTop: 10 },
  description: { marginTop: 8, lineHeight: 21 },
  // `flexBasis` cuida da quebra sem consultar breakpoint: cabendo dois fatos
  // lado a lado eles ficam lado a lado; no celular, um por linha.
  facts: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  fact: { gap: 2, flexGrow: 1, flexBasis: 180, minWidth: 0 },
  // `alignItems: flex-start` de propósito: sem isto as duas colunas ficariam
  // com a mesma altura e o cartão do detalhe teria um vão em branco no fim.
  // O `gap` do AppShell separava os dois cartões; agora eles têm um pai
  // próprio, e o espaçamento tem de vir daqui — inclusive no celular.
  stack: { gap: 16 },
  columns: { flexDirection: 'row', alignItems: 'flex-start' },
  columnAside: { flexGrow: 1, flexBasis: 380, minWidth: 0 },
  columnMain: { flexGrow: 2, flexBasis: 520, minWidth: 0 },
  factLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  factValue: { fontSize: 15 },
  factHint: { fontSize: 12 },
  statusControl: { marginTop: 18 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  note: { marginTop: 10, fontSize: 12, lineHeight: 18 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  totalHours: { fontSize: 13, fontWeight: '600' },
  activity: { paddingTop: 14, marginTop: 14, borderTopWidth: 1, gap: 6 },
  activityNotes: { fontSize: 15, lineHeight: 21 },
  activityMeta: { fontSize: 12 },
  activityActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  newActivity: { paddingTop: 16, marginTop: 16, borderTopWidth: 1 },
  newActivityAction: { flexDirection: 'row' },
})
