import { useRouter } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'

import {
  TICKET_STATUS_FILTERS,
  TICKET_STATUS_FILTER_LABELS,
  type TicketStatusFilter,
} from '../src/api/tickets'
import Button from '../src/components/Button'
import EmptyState from '../src/components/EmptyState'
import ErrorState from '../src/components/ErrorState'
import Input from '../src/components/Input'
import Select from '../src/components/Select'
import Skeleton from '../src/components/Skeleton'
import TicketCard from '../src/components/TicketCard'
import { useAuth } from '../src/context/AuthProvider'
import { MONTHS_PT } from '../src/domain/months'
import { useDebouncedValue } from '../src/hooks/useDebouncedValue'
import { useAvailableYears, useTicketList } from '../src/hooks/useTickets'
import AppShell from '../src/layout/AppShell'
import { navItemsFor } from '../src/layout/nav-items'
import { useBreakpoint } from '../src/layout/useBreakpoint'
import { useTheme } from '../src/theme/ThemeContext'

const PAGE_SIZE = 25

/** Valor sentinela do seletor de período: o `Select` não aceita `null`. */
const ALL_PERIODS = 0

export default function TicketsScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { user, isClient } = useAuth()
  const { isMobile } = useBreakpoint()

  // Calculado uma vez: `new Date()` no corpo do componente muda de identidade a
  // cada render e invalidaria os `useMemo` que dependem dele.
  const [{ currentYear, currentMonth }] = useState(() => {
    const now = new Date()
    return { currentYear: now.getFullYear(), currentMonth: now.getMonth() + 1 }
  })

  const [year, setYear] = useState<number>(currentYear)
  const [month, setMonth] = useState<number>(currentMonth)
  const [status, setStatus] = useState<TicketStatusFilter>('nao_concluidos')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebouncedValue(search)
  const allPeriods = year === ALL_PERIODS

  const params = useMemo(
    () => ({
      // Com `allPeriods`, ano e mês precisam sair da requisição — enviá-los
      // faria a API aplicar o filtro de período de qualquer forma.
      ...(allPeriods ? { allPeriods: true } : { year, month }),
      status,
      search: debouncedSearch.trim() || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [allPeriods, year, month, status, debouncedSearch, page]
  )

  const list = useTicketList(params)
  const years = useAvailableYears()

  // Trocar filtro precisa voltar para a primeira página: manter a página 3 ao
  // filtrar por um status com uma página só devolve uma lista vazia enganosa.
  function updateFilter(apply: () => void) {
    apply()
    setPage(1)
  }

  const yearOptions = useMemo(() => {
    // A anotação não é decorativa: `years.data ?? [...]` produz uma UNIÃO de
    // tipos de array, e o TypeScript não consegue unificar as assinaturas de
    // `.map` sobre uma união — o parâmetro cairia em `any` implícito.
    const available: number[] = years.data ?? [currentYear]
    return [
      ...available.map((value) => ({ value, label: String(value) })),
      { value: ALL_PERIODS, label: 'Todo o período' },
    ]
  }, [years.data, currentYear])

  const total = list.data?.total ?? 0
  const totalPages = list.data?.totalPages ?? 1
  const tickets = list.data?.items ?? []

  const filters = (
    <View style={[styles.filters, !isMobile && styles.filtersWide]}>
      <View style={styles.filterField}>
        <Select
          label="Período"
          value={year}
          options={yearOptions}
          onChange={(value) => updateFilter(() => setYear(value))}
        />
      </View>

      {!allPeriods && (
        <View style={styles.filterField}>
          <Select
            label="Mês"
            value={month}
            options={MONTHS_PT.map((item) => ({ value: item.value, label: item.label }))}
            onChange={(value) => updateFilter(() => setMonth(value))}
          />
        </View>
      )}

      <View style={styles.filterField}>
        <Select
          label="Situação"
          value={status}
          options={TICKET_STATUS_FILTERS.map((value) => ({
            value,
            label: TICKET_STATUS_FILTER_LABELS[value],
          }))}
          onChange={(value) => updateFilter(() => setStatus(value))}
        />
      </View>

      <View style={styles.filterField}>
        <Input
          label="Buscar"
          placeholder="Número ou título"
          value={search}
          onChangeText={(value) => updateFilter(() => setSearch(value))}
          autoCapitalize="none"
        />
      </View>
    </View>
  )

  return (
    <AppShell title="Chamados" navItems={navItemsFor(user)} scroll={false}>
      <FlatList
        data={tickets}
        keyExtractor={(ticket) => String(ticket.id)}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={[styles.count, { color: theme.textSecondary }]}>
                {list.isLoading
                  ? 'Carregando…'
                  : `${total} ${total === 1 ? 'chamado' : 'chamados'}`}
              </Text>
              <Button title="Novo chamado" onPress={() => router.push('/tickets/new')} />
            </View>
            {filters}
          </View>
        }
        ListEmptyComponent={
          list.isLoading ? (
            <View style={styles.skeletons}>
              {[0, 1, 2, 3].map((key) => (
                <Skeleton key={key} height={104} radius={12} />
              ))}
            </View>
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : (
            <EmptyState
              title="Nenhum chamado encontrado"
              description={
                debouncedSearch.trim()
                  ? 'Nenhum resultado para esta busca. Tente outro termo ou amplie o período.'
                  : 'Não há chamados no período e situação selecionados.'
              }
              actionLabel="Abrir chamado"
              onAction={() => router.push('/tickets/new')}
            />
          )
        }
        renderItem={({ item }) => (
          <TicketCard
            ticket={item}
            showClient={!isClient}
            onPress={() => router.push(`/tickets/${item.id}`)}
          />
        )}
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.pagination}>
              <Button
                title="Anterior"
                variant="secondary"
                disabled={page <= 1 || list.isFetching}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
              />
              <Text style={[styles.pageInfo, { color: theme.textSecondary }]}>
                Página {page} de {totalPages}
              </Text>
              <Button
                title="Próxima"
                variant="secondary"
                disabled={page >= totalPages || list.isFetching}
                onPress={() => setPage((current) => Math.min(totalPages, current + 1))}
              />
            </View>
          ) : null
        }
      />
    </AppShell>
  )
}

const styles = StyleSheet.create({
  listContent: { padding: 16, paddingBottom: 32 },
  header: { gap: 12, marginBottom: 12 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  count: { fontSize: 14, fontWeight: '600' },
  filters: { gap: 0 },
  filtersWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  filterField: { flexGrow: 1, flexBasis: 200 },
  separator: { height: 10 },
  skeletons: { gap: 10 },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
    flexWrap: 'wrap',
  },
  pageInfo: { fontSize: 13 },
})
