import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { Payment } from '../../src/api/admin'
import { toMessage } from '../../src/api/to-message'
import Button from '../../src/components/Button'
import Card from '../../src/components/Card'
import ConfirmationDialog from '../../src/components/ConfirmationDialog'
import DateField from '../../src/components/DateField'
import EmptyState from '../../src/components/EmptyState'
import ErrorState from '../../src/components/ErrorState'
import Input from '../../src/components/Input'
import Skeleton from '../../src/components/Skeleton'
import StatTile from '../../src/components/StatTile'
import { useToast } from '../../src/components/Toast'
import { useAuth } from '../../src/context/AuthProvider'
import { validateDecimalInput } from '../../src/domain/decimal-input'
import { formatIsoDate, todayIsoDate } from '../../src/domain/format'
import { useCreatePayment, useDeletePayment, usePayments } from '../../src/hooks/useAdmin'
import AppShell from '../../src/layout/AppShell'
import { useBreakpoint } from '../../src/layout/useBreakpoint'
import { useTheme } from '../../src/theme/ThemeContext'

export default function AdminPayments() {
  const theme = useTheme()
  const toast = useToast()
  const { isSuperuser } = useAuth()
  const { isMobile } = useBreakpoint()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [toDelete, setToDelete] = useState<Payment | null>(null)

  const [paidAt, setPaidAt] = useState(() => todayIsoDate())
  const [amount, setAmount] = useState('')
  const [paidHours, setPaidHours] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const list = usePayments({ from: from || undefined, to: to || undefined, page, pageSize: 25 })
  const createPayment = useCreatePayment()
  const deletePayment = useDeletePayment()

  if (!isSuperuser) {
    return (
      <AppShell title="Pagamentos">
        <Card>
          <EmptyState
            title="Sem permissão"
            description="O registro de pagamentos é restrito a superusuários."
          />
        </Card>
      </AppShell>
    )
  }

  async function handleCreate() {
    if (createPayment.isPending) return

    const next: Record<string, string> = {}
    if (!paidAt) next.paidAt = 'Informe a data do pagamento.'

    // A API interpreta "1.500" como 1,5 (paridade com o `float()` do legado).
    // Sem esta guarda, quem digita o valor com separador de milhar grava mil
    // vezes menos, em silêncio.
    const amountCheck = validateDecimalInput(amount, 'o valor')
    if (!amountCheck.ok) next.amount = amountCheck.error as string

    const hoursCheck = validateDecimalInput(paidHours, 'as horas pagas')
    if (!hoursCheck.ok) next.paidHours = hoursCheck.error as string

    setErrors(next)
    if (Object.keys(next).length > 0) return

    try {
      // Vírgula decimal é aceita pela API, como no legado. Separador de milhar
      // é rejeitado de propósito: "1.234" seria ambíguo entre mil e 1,234.
      await createPayment.mutateAsync({
        paidAt,
        amount: amount.trim(),
        paidHours: paidHours.trim(),
      })
      toast.show('Pagamento registrado.', 'success')
      setAmount('')
      setPaidHours('')
      setPaidAt(todayIsoDate())
    } catch (caught) {
      setErrors({ form: toMessage(caught) })
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    try {
      await deletePayment.mutateAsync(toDelete.id)
      toast.show('Pagamento excluído.', 'success')
    } catch (caught) {
      toast.show(toMessage(caught), 'error')
    } finally {
      setToDelete(null)
    }
  }

  const payments: Payment[] = list.data?.items ?? []

  return (
    <AppShell title="Pagamentos">
      <Card>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Registrar pagamento</Text>
        <View style={[styles.fields, !isMobile && styles.fieldsWide]}>
          <View style={!isMobile ? styles.field : undefined}>
            <DateField
              label="Data"
              value={paidAt}
              onChange={setPaidAt}
              error={errors.paidAt}
              disabled={createPayment.isPending}
            />
          </View>
          <View style={!isMobile ? styles.field : undefined}>
            <Input
              label="Valor (R$)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="1500,00"
              error={errors.amount}
              disabled={createPayment.isPending}
            />
          </View>
          <View style={!isMobile ? styles.field : undefined}>
            <Input
              label="Horas pagas"
              value={paidHours}
              onChangeText={setPaidHours}
              keyboardType="numeric"
              placeholder="10,5"
              error={errors.paidHours}
              disabled={createPayment.isPending}
            />
          </View>
        </View>

        {errors.form && (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
            {errors.form}
          </Text>
        )}

        <View style={styles.actions}>
          <Button
            title="Registrar"
            icon="plus"
            onPress={() => void handleCreate()}
            loading={createPayment.isPending}
          />
        </View>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Filtrar período</Text>
        <View style={[styles.fields, !isMobile && styles.fieldsWide]}>
          <View style={!isMobile ? styles.field : undefined}>
            <DateField
              label="De"
              value={from}
              onChange={(value) => {
                setFrom(value)
                setPage(1)
              }}
            />
          </View>
          <View style={!isMobile ? styles.field : undefined}>
            <DateField
              label="Até"
              value={to}
              onChange={(value) => {
                setTo(value)
                setPage(1)
              }}
            />
          </View>
        </View>

        {list.data && (
          <View style={styles.tiles}>
            {/* `formatted` vem pronto da API em pt-BR; reformatar a partir de
                `value` só criaria uma segunda fonte de verdade. */}
            <StatTile
              label="Total pago no período"
              value={`R$ ${list.data.totals.amount.formatted}`}
            />
            <StatTile label="Horas pagas" value={`${list.data.totals.paidHours.formatted} h`} />
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
      ) : payments.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum pagamento"
            description="Nenhum pagamento registrado no período selecionado."
          />
        </Card>
      ) : (
        <Card>
          {payments.map((item, index) => (
            <View
              key={item.id}
              style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}
            >
              {/* Valor e data como duas colunas em tela larga: empilhados, o
                  olho volta ao começo da linha para ler a data. */}
              <View style={[styles.rowInfo, !isMobile && styles.rowInfoWide]}>
                <Text style={[styles.rowValue, { color: theme.textPrimary }]}>
                  R$ {item.amount.formatted}
                </Text>
                <Text
                  style={[styles.rowMeta, { color: theme.textSecondary }, !isMobile && styles.grow]}
                >
                  {formatIsoDate(item.paidAt)} · {item.paidHours.formatted} h
                </Text>
              </View>
              <Button
                title="Excluir"
                variant="danger"
                icon="trash"
                onPress={() => setToDelete(item)}
              />
            </View>
          ))}

          {list.data.totalPages > 1 && (
            <View style={styles.pagination}>
              <Button
                title="Anterior"
                icon="chevron-left"
                variant="secondary"
                disabled={page <= 1}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
              />
              <Text style={[styles.pageInfo, { color: theme.textSecondary }]}>
                Página {page} de {list.data.totalPages}
              </Text>
              <Button
                title="Próxima"
                icon="chevron-right"
                iconPosition="right"
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
        title="Excluir este pagamento?"
        description="As horas voltam a contar no banco de horas. Diferente de chamados e atividades, pagamentos podem ser excluídos de qualquer mês."
        confirmLabel="Excluir pagamento"
        busy={deletePayment.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </AppShell>
  )
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  fields: { gap: 0 },
  fieldsWide: { flexDirection: 'row', gap: 12 },
  // Só vale na LINHA: num contêiner em coluna (celular) `flexBasis` é
  // ALTURA, e cada campo viraria uma caixa dessa altura. Por isso o
  // estilo é aplicado condicionalmente, como em `analytics`.
  field: { flexGrow: 1, flexBasis: 160, minWidth: 0 },
  error: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowInfo: { flex: 1, gap: 2 },
  rowInfoWide: { flexDirection: 'row', alignItems: 'baseline', gap: 16 },
  rowValue: { fontSize: 15, fontWeight: '700' },
  grow: { flex: 1 },
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
