import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { SystemModule } from '../../src/api/admin'
import { toMessage } from '../../src/api/to-message'
import Button from '../../src/components/Button'
import Card from '../../src/components/Card'
import ConfirmationDialog from '../../src/components/ConfirmationDialog'
import EmptyState from '../../src/components/EmptyState'
import ErrorState from '../../src/components/ErrorState'
import Input from '../../src/components/Input'
import Skeleton from '../../src/components/Skeleton'
import StatusBadge from '../../src/components/StatusBadge'
import { useToast } from '../../src/components/Toast'
import { useAuth } from '../../src/context/AuthProvider'
import {
  useCreateModule,
  useDeleteModule,
  useModules,
  useToggleModule,
} from '../../src/hooks/useAdmin'
import AppShell from '../../src/layout/AppShell'
import { navItemsFor } from '../../src/layout/nav-items'
import { useTheme } from '../../src/theme/ThemeContext'

export default function AdminModules() {
  const theme = useTheme()
  const toast = useToast()
  const { user, isSuperuser } = useAuth()

  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<SystemModule | null>(null)

  const list = useModules({ page: 1, pageSize: 100 })
  const createModule = useCreateModule()
  const toggleModule = useToggleModule()
  const deleteModule = useDeleteModule()

  if (!isSuperuser) {
    return (
      <AppShell title="Módulos" navItems={navItemsFor(user)}>
        <Card>
          <EmptyState
            title="Sem permissão"
            description="A administração de módulos é restrita a superusuários."
          />
        </Card>
      </AppShell>
    )
  }

  async function handleCreate() {
    if (createModule.isPending) return
    if (!name.trim()) {
      setError('Informe o nome do módulo.')
      return
    }

    setError(null)
    try {
      await createModule.mutateAsync({ name: name.trim(), isActive: true })
      toast.show('Módulo criado.', 'success')
      setName('')
    } catch (caught) {
      // A unicidade é case-insensitive nas duas camadas (aplicação e índice
      // funcional `lower(name)`), então "Financeiro" colide com "financeiro".
      setError(toMessage(caught))
    }
  }

  async function handleToggle(item: SystemModule) {
    try {
      await toggleModule.mutateAsync(item.id)
      toast.show(item.isActive ? 'Módulo desativado.' : 'Módulo ativado.', 'success')
    } catch (caught) {
      toast.show(toMessage(caught), 'error')
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    try {
      await deleteModule.mutateAsync(toDelete.id)
      toast.show('Módulo excluído.', 'success')
    } catch (caught) {
      toast.show(toMessage(caught), 'error')
    } finally {
      setToDelete(null)
    }
  }

  const modules: SystemModule[] = list.data?.items ?? []

  return (
    <AppShell title="Módulos do sistema" navItems={navItemsFor(user)}>
      <Card>
        <Input
          label="Novo módulo"
          placeholder="Nome do módulo"
          value={name}
          onChangeText={setName}
          error={error ?? undefined}
          hint="O nome é único, sem diferenciar maiúsculas de minúsculas."
          disabled={createModule.isPending}
          returnKeyType="done"
          onSubmitEditing={() => void handleCreate()}
        />
        <View style={styles.actions}>
          <Button
            title="Adicionar"
            onPress={() => void handleCreate()}
            loading={createModule.isPending}
          />
        </View>
      </Card>

      {list.isError && !list.data ? (
        <Card>
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        </Card>
      ) : !list.data ? (
        <Card>
          <Skeleton height={100} radius={12} />
        </Card>
      ) : modules.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum módulo"
            description="Cadastre o primeiro módulo para permitir a abertura de chamados."
          />
        </Card>
      ) : (
        <Card>
          <Text style={[styles.note, { color: theme.muted }]}>
            Chamados só podem ser abertos em módulos ativos. Desativar um módulo não trava a edição
            dos chamados já ligados a ele.
          </Text>
          {modules.map((item, index) => (
            <View
              key={item.id}
              style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}
            >
              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, { color: theme.textPrimary }]}>{item.name}</Text>
                <StatusBadge
                  status={item.isActive ? 'resolvido' : 'fechado'}
                  label={item.isActive ? 'Ativo' : 'Inativo'}
                />
              </View>
              <View style={styles.rowActions}>
                <Button
                  title={item.isActive ? 'Desativar' : 'Ativar'}
                  variant="secondary"
                  onPress={() => void handleToggle(item)}
                  disabled={toggleModule.isPending}
                />
                <Button title="Excluir" variant="danger" onPress={() => setToDelete(item)} />
              </View>
            </View>
          ))}
        </Card>
      )}

      <ConfirmationDialog
        visible={toDelete !== null}
        title={`Excluir o módulo ${toDelete?.name ?? ''}?`}
        description="A exclusão é recusada se houver chamados ligados a este módulo. Nesse caso, desative-o."
        confirmLabel="Excluir módulo"
        busy={deleteModule.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </AppShell>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  note: { fontSize: 12, lineHeight: 17, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    flexWrap: 'wrap',
  },
  rowInfo: { flex: 1, gap: 6, minWidth: 140 },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowActions: { flexDirection: 'row', gap: 8 },
})
