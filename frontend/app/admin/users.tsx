import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { ApiUser, UserRole } from '../../src/api/client'
import { toMessage } from '../../src/api/to-message'
import Button from '../../src/components/Button'
import Card from '../../src/components/Card'
import ConfirmationDialog from '../../src/components/ConfirmationDialog'
import EmptyState from '../../src/components/EmptyState'
import ErrorState from '../../src/components/ErrorState'
import Input from '../../src/components/Input'
import Select from '../../src/components/Select'
import Skeleton from '../../src/components/Skeleton'
import { useToast } from '../../src/components/Toast'
import { useAuth } from '../../src/context/AuthProvider'
import { useCreateUser, useDeleteUser, useUsers } from '../../src/hooks/useAdmin'
import AppShell from '../../src/layout/AppShell'
import { navItemsFor } from '../../src/layout/nav-items'
import { useTheme } from '../../src/theme/ThemeContext'

const PASSWORD_MIN_LENGTH = 6
const ALL_ROLES = 'all'

export default function AdminUsers() {
  const theme = useTheme()
  const toast = useToast()
  const { user, isSuperuser } = useAuth()

  const [roleFilter, setRoleFilter] = useState<UserRole | typeof ALL_ROLES>(ALL_ROLES)
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [toDelete, setToDelete] = useState<ApiUser | null>(null)

  const list = useUsers({
    ...(roleFilter === ALL_ROLES ? {} : { role: roleFilter }),
    page,
    pageSize: 25,
  })
  const createUser = useCreateUser()
  const deleteUser = useDeleteUser()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('client')
  const [mustChangePassword, setMustChangePassword] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function resetForm() {
    setName('')
    setEmail('')
    setPassword('')
    setRole('client')
    setMustChangePassword(true)
    setErrors({})
  }

  async function handleCreate() {
    if (createUser.isPending) return

    const next: Record<string, string> = {}
    if (name.trim().length < 2) next.name = 'Informe o nome.'
    if (!email.trim().includes('@')) next.email = 'Informe um e-mail válido.'
    if (password.length < PASSWORD_MIN_LENGTH) {
      next.password = `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

    try {
      await createUser.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        mustChangePassword,
      })
      toast.show('Usuário criado.', 'success')
      resetForm()
      setShowForm(false)
    } catch (caught) {
      setErrors({ form: toMessage(caught) })
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    try {
      await deleteUser.mutateAsync(toDelete.id)
      toast.show('Usuário excluído.', 'success')
    } catch (caught) {
      // A API recusa excluir o próprio usuário, o último superuser e quem tem
      // chamados ou atividades — a mensagem dela explica qual é o caso.
      toast.show(toMessage(caught), 'error')
    } finally {
      setToDelete(null)
    }
  }

  const users: ApiUser[] = list.data?.items ?? []

  return (
    <AppShell title="Usuários" navItems={navItemsFor(user)}>
      <Card>
        <View style={styles.headerRow}>
          <View style={styles.filterField}>
            <Select
              label="Perfil"
              value={roleFilter}
              options={[
                { value: ALL_ROLES, label: 'Todos' },
                { value: 'client', label: 'Clientes' },
                { value: 'technician', label: 'Técnicos' },
              ]}
              onChange={(value) => {
                setRoleFilter(value as UserRole | typeof ALL_ROLES)
                setPage(1)
              }}
            />
          </View>
          <Button
            title={showForm ? 'Fechar' : 'Novo usuário'}
            variant={showForm ? 'secondary' : 'primary'}
            onPress={() => setShowForm((open) => !open)}
          />
        </View>

        {showForm && (
          <View style={[styles.form, { borderTopColor: theme.border }]}>
            <Input
              label="Nome"
              value={name}
              onChangeText={setName}
              error={errors.name}
              disabled={createUser.isPending}
            />
            <Input
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              disabled={createUser.isPending}
            />
            <Input
              label="Senha inicial"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              hint={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`}
              error={errors.password}
              disabled={createUser.isPending}
            />
            <Select
              label="Perfil"
              value={role}
              options={[
                { value: 'client', label: 'Cliente' },
                { value: 'technician', label: 'Técnico' },
              ]}
              onChange={setRole}
              disabled={createUser.isPending}
            />
            <Select
              label="Exigir troca de senha no primeiro acesso"
              value={mustChangePassword ? 'sim' : 'nao'}
              options={[
                { value: 'sim', label: 'Sim' },
                { value: 'nao', label: 'Não' },
              ]}
              onChange={(value) => setMustChangePassword(value === 'sim')}
              disabled={createUser.isPending}
            />

            {!isSuperuser && (
              <Text style={[styles.note, { color: theme.muted }]}>
                Somente um superusuário pode conceder privilégio de superusuário.
              </Text>
            )}

            {errors.form && (
              <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
                {errors.form}
              </Text>
            )}

            <View style={styles.actions}>
              <Button
                title="Cancelar"
                variant="secondary"
                onPress={() => {
                  resetForm()
                  setShowForm(false)
                }}
                disabled={createUser.isPending}
              />
              <Button
                title="Criar usuário"
                onPress={() => void handleCreate()}
                loading={createUser.isPending}
              />
            </View>
          </View>
        )}
      </Card>

      {list.isError && !list.data ? (
        <Card>
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        </Card>
      ) : !list.data ? (
        <Card>
          <Skeleton height={100} radius={12} />
        </Card>
      ) : users.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum usuário" description="Nenhum usuário com este perfil." />
        </Card>
      ) : (
        <Card>
          {users.map((item, index) => (
            <View
              key={item.id}
              style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}
            >
              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, { color: theme.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>{item.email}</Text>
                <Text style={[styles.rowMeta, { color: theme.muted }]}>
                  {item.role === 'technician' ? 'Técnico' : 'Cliente'}
                  {item.isSuperuser && ' · Superusuário'}
                  {item.mustChangePassword && ' · Troca de senha pendente'}
                </Text>
              </View>
              {/* A API recusa excluir o próprio usuário; esconder o botão só
                  evita o erro previsível. */}
              {item.id !== user?.id && (
                <Button title="Excluir" variant="danger" onPress={() => setToDelete(item)} />
              )}
            </View>
          ))}

          {list.data.totalPages > 1 && (
            <View style={styles.pagination}>
              <Button
                title="Anterior"
                variant="secondary"
                disabled={page <= 1}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
              />
              <Text style={[styles.pageInfo, { color: theme.textSecondary }]}>
                Página {page} de {list.data.totalPages}
              </Text>
              <Button
                title="Próxima"
                variant="secondary"
                disabled={page >= list.data.totalPages}
                onPress={() => setPage((current) => current + 1)}
              />
            </View>
          )}
        </Card>
      )}

      <ConfirmationDialog
        visible={toDelete !== null}
        title={`Excluir ${toDelete?.name ?? ''}?`}
        description="A exclusão é recusada se o usuário tiver chamados ou atividades registradas."
        confirmLabel="Excluir usuário"
        busy={deleteUser.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </AppShell>
  )
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  filterField: { flexGrow: 1, flexBasis: 180 },
  form: { marginTop: 8, paddingTop: 16, borderTopWidth: 1 },
  note: { fontSize: 12, marginBottom: 10, lineHeight: 17 },
  error: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowMeta: { fontSize: 12 },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  pageInfo: { fontSize: 13 },
})
