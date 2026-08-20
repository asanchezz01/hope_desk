import { useRouter } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'

import {
  TICKET_STATUS_FILTERS,
  TICKET_STATUS_FILTER_LABELS,
  type Ticket,
  type TicketStatusFilter,
} from '../src/api/tickets'
import { toMessage } from '../src/api/to-message'
import Button from '../src/components/Button'
import Card from '../src/components/Card'
import EmptyState from '../src/components/EmptyState'
import ErrorState from '../src/components/ErrorState'
import Input from '../src/components/Input'
import Select from '../src/components/Select'
import Skeleton from '../src/components/Skeleton'
import StatTile from '../src/components/StatTile'
import TicketCard from '../src/components/TicketCard'
import { useToast } from '../src/components/Toast'
import { useAuth } from '../src/context/AuthProvider'
import { formatHours } from '../src/domain/format'
import { MONTHS_PT } from '../src/domain/months'
import { useDebouncedValue } from '../src/hooks/useDebouncedValue'
import { useMonthlyHoursSummary } from '../src/hooks/useMonthlyHoursSummary'
import { useReportPdf } from '../src/hooks/useReports'
import { useAvailableYears, useTicketList } from '../src/hooks/useTickets'
import AppShell from '../src/layout/AppShell'
import { navItemsFor } from '../src/layout/nav-items'
import { useBreakpoint } from '../src/layout/useBreakpoint'
import { readTicketFilters, saveTicketFilters } from '../src/storage/preferences'
import { useIsDark, useTheme } from '../src/theme/ThemeContext'
import { statusChartColor } from '../src/theme/chart-palette'

const PAGE_SIZE = 25

/** Valor sentinela do seletor de período: o `Select` não aceita `null`. */
const ALL_PERIODS = 0

/** Célula da grade: um chamado, ou um vão para completar a última linha. */
type TicketRow = Ticket | { spacerKey: string }

export default function TicketsScreen() {
  const theme = useTheme()
  const isDark = useIsDark()
  const router = useRouter()
  const { user, isClient } = useAuth()
  const { isMobile, wideMaxWidth, gridColumns } = useBreakpoint()

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

  // Filtros salvos (Fase 11). A leitura é assíncrona, então a tela começa nos
  // padrões e é corrigida quando o disco responde. `filtersLoaded` impede que o
  // efeito de gravação rode antes disso e sobrescreva a escolha guardada com o
  // padrão — o bug clássico deste par de efeitos.
  const [filtersLoaded, setFiltersLoaded] = useState(false)

  useEffect(() => {
    let active = true
    void readTicketFilters().then((stored) => {
      if (!active) return
      if (stored) {
        setYear(stored.year)
        setMonth(stored.month)
        // O status vem de uma versão anterior do aplicativo e pode não existir
        // mais na lista de hoje; nesse caso o padrão prevalece.
        if ((TICKET_STATUS_FILTERS as readonly string[]).includes(stored.status)) {
          setStatus(stored.status as TicketStatusFilter)
        }
      }
      setFiltersLoaded(true)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!filtersLoaded) return
    void saveTicketFilters({ year, month, status })
  }, [filtersLoaded, year, month, status])

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
  const toast = useToast()

  // Só com mês concreto os dois números "fora do grid" fazem sentido; com
  // "Todo o período" a consulta fica desligada.
  const monthlySummary = useMonthlyHoursSummary({ year, month }, !allPeriods)
  const pdf = useReportPdf()

  async function downloadPdf() {
    try {
      await pdf.mutateAsync({
        source: 'services',
        params: { year, month },
        fallbackName: `demonstrativo-servicos-${year}-${String(month).padStart(2, '0')}.pdf`,
      })
      toast.show('PDF gerado.', 'success')
    } catch (caught) {
      toast.show(toMessage(caught), 'error')
    }
  }

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
  const items = list.data?.items

  // `numColumns` estica o último item quando a linha fica incompleta: um cartão
  // sozinho ocuparia a largura de dois, e a lista termina com um degrau. Os
  // espaços invisíveis completam a linha e mantêm a coluna do tamanho certo.
  const rows: TicketRow[] = useMemo(() => {
    const tickets = items ?? []
    if (gridColumns === 1) return tickets
    const missing = (gridColumns - (tickets.length % gridColumns)) % gridColumns
    return [
      ...tickets,
      ...Array.from({ length: missing }, (_, index) => ({ spacerKey: `spacer-${index}` })),
    ]
  }, [items, gridColumns])

  const filters = (
    <View style={styles.filters}>
      <View style={styles.filterRow}>
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
      </View>

      <View style={styles.filterRow}>
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
    </View>
  )

  // Cartão-resumo do dashboard do legado. Com mês concreto, os três números
  // mensais existem; com "Todo o período" só as somas do recorte fazem sentido.
  const summary = list.data?.summary
  const monthlyLoading = monthlySummary.isLoading || monthlySummary.isFetching
  const monthlyValue = (value: number | undefined) =>
    value === undefined ? (monthlyLoading ? '…' : '—') : formatHours(value)

  // No celular os quadros empilham: sem isto o `flexBasis` do StatTile viraria
  // ALTURA e cada um ocuparia 150px com metade vazia.
  const stacked = isMobile ? styles.stackedTile : undefined

  const summaryCard = (
    <Card>
      <View style={[styles.summaryRow, !isMobile && styles.summaryRowWide]}>
        {allPeriods ? (
          <StatTile
            style={stacked}
            accent={theme.chartMagnitude}
            label="Total de horas do período"
            value={summary ? formatHours(summary.periodTotalHours) : list.isLoading ? '…' : '—'}
            hint="Todo o histórico"
          />
        ) : (
          <>
            <StatTile
              style={stacked}
              accent={theme.chartMagnitude}
              label="Total de horas do período"
              value={summary ? formatHours(summary.periodTotalHours) : list.isLoading ? '…' : '—'}
              hint="Chamados criados no mês"
            />
            <StatTile
              style={stacked}
              accent={statusChartColor('em_andamento', isDark)}
              label="Atividades do período em chamados de outros meses"
              value={monthlyValue(monthlySummary.data?.externalTicketActivityHours)}
              hint={monthlyLoading ? 'Carregando…' : 'Somente lançamento no mês'}
            />
            <StatTile
              style={stacked}
              accent={theme.chartSecondary}
              label="Total de horas do mês"
              value={
                summary && monthlySummary.data
                  ? formatHours(
                      summary.periodTotalHours + monthlySummary.data.externalTicketActivityHours
                    )
                  : list.isLoading || monthlyLoading
                    ? '…'
                    : '—'
              }
              hint="Criados no mês + lançados de outros meses"
            />
            <StatTile
              style={stacked}
              accent={statusChartColor('resolvido', isDark)}
              label="Horas pagas no período selecionado"
              value={monthlyValue(monthlySummary.data?.paidHoursInMonth)}
            />
          </>
        )}
      </View>
      <View
        accessibilityRole="summary"
        accessibilityLabel={`Total de horas no grid: ${
          summary ? formatHours(summary.gridTotalHours) : 'carregando'
        }`}
        style={styles.summaryGridTotal}
      >
        <Text style={[styles.summaryGridTotalLabel, { color: theme.muted }]}>
          Total de horas no grid
        </Text>
        <Text style={[styles.summaryGridTotalValue, { color: theme.textPrimary }]}>
          {summary ? formatHours(summary.gridTotalHours) : list.isLoading ? '…' : '—'}
        </Text>
      </View>
    </Card>
  )

  return (
    <AppShell title="Chamados" navItems={navItemsFor(user)} scroll={false}>
      <FlatList
        // Trocar `numColumns` em uma FlatList já montada é um erro em tempo de
        // execução no React Native; a `key` força a remontagem ao girar a tela
        // ou redimensionar a janela.
        key={`cols-${gridColumns}`}
        data={rows}
        numColumns={gridColumns}
        columnWrapperStyle={gridColumns > 1 ? styles.gridRow : undefined}
        keyExtractor={(row) => ('spacerKey' in row ? row.spacerKey : String(row.id))}
        contentContainerStyle={[
          styles.listContent,
          // `AppShell scroll={false}` entrega a região de tamanho total para a
          // lista rolar; o recorte de largura + centralização é daqui, no
          // container de conteúdo (uma coluna), casando com o painel de gráficos.
          { width: '100%', maxWidth: wideMaxWidth, alignSelf: 'center' },
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            // `isLoading` é a primeira carga, que já tem esqueleto: mostrar o
            // indicador de refresh junto duplicaria a sinalização.
            refreshing={list.isRefetching && !list.isLoading}
            onRefresh={() => void list.refetch()}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={[styles.count, { color: theme.textSecondary }]}>
                {list.isLoading
                  ? 'Carregando…'
                  : `${total} ${total === 1 ? 'chamado' : 'chamados'}`}
              </Text>
              <View style={styles.headerActions}>
                {/* O demonstrativo é mensal; sem mês concreto não há o que exportar. */}
                <Button
                  title="Exportar PDF"
                  variant="secondary"
                  icon="file-pdf"
                  disabled={allPeriods}
                  loading={pdf.isPending}
                  onPress={downloadPdf}
                />
                <Button
                  title="Novo chamado"
                  icon="plus"
                  onPress={() => router.push('/tickets/new')}
                />
              </View>
            </View>
            {summaryCard}
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
        renderItem={({ item }) => {
          // `flex: 1` só dentro da linha: em coluna única ele não muda nada, e
          // sem ele os cartões de uma linha ficam com larguras diferentes.
          const cell = gridColumns > 1 ? styles.gridItem : undefined
          if ('spacerKey' in item) return <View style={cell} />
          return (
            <TicketCard
              ticket={item}
              showClient={!isClient}
              style={cell}
              onPress={() => router.push(`/tickets/${item.id}`)}
            />
          )
        }}
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.pagination}>
              <Button
                title="Anterior"
                variant="secondary"
                icon="chevron-left"
                disabled={page <= 1 || list.isFetching}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
              />
              <Text style={[styles.pageInfo, { color: theme.textSecondary }]}>
                Página {page} de {totalPages}
              </Text>
              <Button
                title="Próxima"
                variant="secondary"
                icon="chevron-right"
                iconPosition="right"
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
  headerActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  summaryRow: { gap: 10 },
  summaryRowWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stackedTile: { flexBasis: 'auto' },
  summaryGridTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.25)',
  },
  summaryGridTotalLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryGridTotalValue: { fontSize: 18, fontWeight: '700' },
  count: { fontSize: 14, fontWeight: '600' },
  filters: { gap: 0 },
  filterRow: { flexDirection: 'row', columnGap: 12 },
  filterField: { flex: 1, minWidth: 0 },
  separator: { height: 10 },
  gridRow: { gap: 10, alignItems: 'stretch' },
  gridItem: { flex: 1 },
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
