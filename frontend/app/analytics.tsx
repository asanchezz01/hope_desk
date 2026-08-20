import { useRouter } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { AnalyticsResponse } from '../src/api/analytics'
import BarList, { type BarListItem } from '../src/components/BarList'
import Card from '../src/components/Card'
import ErrorState from '../src/components/ErrorState'
import FilterChips, { type FilterChip } from '../src/components/FilterChips'
import InsightBanner from '../src/components/InsightBanner'
import Select from '../src/components/Select'
import Skeleton from '../src/components/Skeleton'
import StatTile from '../src/components/StatTile'
import ComboTimeSeries, { type SeriesPoint } from '../src/components/charts/ComboTimeSeries'
import DonutChart from '../src/components/charts/DonutChart'
import { useAuth } from '../src/context/AuthProvider'
import {
  countBy,
  crossKpis,
  fixedCategories,
  filterActivities,
  filterTickets,
  NO_FILTERS,
  sumBy,
  toggleFilter,
  type AnalyticsFilters,
  type FilterDimension,
} from '../src/domain/analytics-filters'
import { buildInsights } from '../src/domain/analytics-insights'
import { formatDecimal, formatInteger } from '../src/domain/format'
import { MONTHS_PT } from '../src/domain/months'
import { useAnalytics } from '../src/hooks/useAnalytics'
import AppShell from '../src/layout/AppShell'
import { navItemsFor } from '../src/layout/nav-items'
import { useBreakpoint } from '../src/layout/useBreakpoint'
import { useIsDark, useTheme } from '../src/theme/ThemeContext'
import { STATUS_CHART_ORDER, statusChartColor } from '../src/theme/chart-palette'

/** Sentinelas dos seletores — o `Select` não aceita `null`. */
const ALL_PERIODS = 0
const WHOLE_YEAR = 0

/** Quantas linhas da tabela vão para a tela. O resto está nos gráficos. */
const TABLE_LIMIT = 40

const DIMENSION_LABELS: Record<FilterDimension, string> = {
  status: 'Situação',
  module: 'Módulo',
  tech: 'Técnico',
  client: 'Cliente',
  bucket: 'Período',
}

/**
 * Painel de Indicadores.
 *
 * Duas coisas o definem, e as duas vêm do painel antigo:
 *
 * 1. **Filtro cruzado.** Clicar numa fatia, numa barra ou numa coluna recorta o
 *    painel inteiro — indicadores, gráficos e tabela. Sem requisição nova: a
 *    API já devolve `tickets` e `activities` linha a linha, e as contas são
 *    refeitas aqui, como o legado fazia no `<script>` da página.
 *
 * 2. **Densidade.** Os indicadores em grade e os gráficos lado a lado, não uma
 *    coluna de cards que exige rolar para comparar dois números.
 *
 * O que NÃO veio do legado é o eixo duplo (ver `PairedTimeSeries`) e a cor
 * sorteada por categoria (ver `BarList`) — os dois enganavam a leitura.
 */
export default function Analytics() {
  const theme = useTheme()
  const isDark = useIsDark()
  const router = useRouter()
  const { user } = useAuth()
  const { isMobile } = useBreakpoint()

  const [{ currentYear, currentMonth }] = useState(() => {
    const now = new Date()
    return { currentYear: now.getFullYear(), currentMonth: now.getMonth() + 1 }
  })

  const [year, setYear] = useState<number>(currentYear)
  const [month, setMonth] = useState<number>(currentMonth)
  const [filters, setFilters] = useState<AnalyticsFilters>(NO_FILTERS)

  const params = useMemo(() => {
    if (year === ALL_PERIODS) return { allPeriods: true }
    if (month === WHOLE_YEAR) return { year }
    return { year, month }
  }, [year, month])

  const analytics = useAnalytics(params)
  const data = analytics.data

  /** Trocar de período zera o recorte: um módulo de março não recorta abril. */
  function selectPeriod(next: { year?: number; month?: number }) {
    if (next.year !== undefined) setYear(next.year)
    if (next.month !== undefined) setMonth(next.month)
    setFilters(NO_FILTERS)
  }

  function toggle(dimension: FilterDimension, value: string) {
    setFilters((current) => toggleFilter(current, dimension, value))
  }

  const yearOptions = useMemo(() => {
    const available: number[] = data?.availableYears ?? [currentYear]
    return [
      ...available.map((value) => ({ value, label: String(value) })),
      { value: ALL_PERIODS, label: 'Todo o período' },
    ]
  }, [data?.availableYears, currentYear])

  const monthOptions = useMemo(
    () => [
      { value: WHOLE_YEAR, label: 'Ano inteiro' },
      ...MONTHS_PT.map((item) => ({ value: item.value, label: item.label })),
    ],
    []
  )

  if (analytics.isError && !data) {
    return (
      <AppShell title="Painel de Indicadores" navItems={navItemsFor(user)} width="wide">
        <ErrorState error={analytics.error} onRetry={() => void analytics.refetch()} />
      </AppShell>
    )
  }

  return (
    <AppShell title="Painel de Indicadores" navItems={navItemsFor(user)} width="wide">
      {/* Uma linha de filtros, acima de tudo o que ela recorta. Nunca um filtro
          dentro de um card de gráfico: os números têm de concordar entre si. */}
      <Card>
        <View style={styles.filters}>
          <View style={styles.filterField}>
            <Select
              label="Período"
              value={year}
              options={yearOptions}
              onChange={(value) => selectPeriod({ year: value })}
            />
          </View>
          {year !== ALL_PERIODS && (
            <View style={styles.filterField}>
              <Select
                label="Mês"
                value={month}
                options={monthOptions}
                onChange={(value) => selectPeriod({ month: value })}
              />
            </View>
          )}
        </View>

        <View style={styles.filterFoot}>
          {data && (
            <Text style={[styles.periodLabel, { color: theme.textPrimary }]}>
              {data.periodLabel}
            </Text>
          )}
          <Text style={[styles.filterHint, { color: theme.muted }]}>
            Toque nas fatias, barras e colunas para recortar o painel inteiro.
          </Text>
        </View>
      </Card>

      {data && (
        <Dashboard
          data={data}
          filters={filters}
          isDark={isDark}
          wide={!isMobile}
          isClient={user?.role === 'client'}
          /* Enquanto o período recarrega, o painel anterior fica no lugar em
             opacidade reduzida: sem esqueleto, sem salto de layout. */
          stale={analytics.isFetching}
          onToggle={toggle}
          onClearFilters={() => setFilters(NO_FILTERS)}
          onPickMonth={(pickedYear, pickedMonth) =>
            selectPeriod({ year: pickedYear, month: pickedMonth })
          }
          onOpenTicket={(id) => router.push(`/tickets/${id}` as never)}
        />
      )}

      {!data && (
        <View style={styles.loading}>
          <Skeleton height={96} radius={12} />
          <Skeleton height={220} radius={12} />
          <Skeleton height={220} radius={12} />
        </View>
      )}
    </AppShell>
  )
}

interface DashboardProps {
  data: AnalyticsResponse
  filters: AnalyticsFilters
  isDark: boolean
  /** A partir do tablet os cards vão lado a lado. */
  wide: boolean
  isClient: boolean
  stale: boolean
  onToggle: (dimension: FilterDimension, value: string) => void
  onClearFilters: () => void
  onPickMonth: (year: number, month: number) => void
  onOpenTicket: (id: number) => void
}

function Dashboard({
  data,
  filters,
  isDark,
  wide,
  isClient,
  stale,
  onToggle,
  onClearFilters,
  onPickMonth,
  onOpenTicket,
}: DashboardProps) {
  const theme = useTheme()

  // Categorias fixas, tiradas do conjunto COMPLETO: o eixo não pode reordenar
  // quando um filtro liga, ou quem clicou perde a referência que acabou de usar.
  const moduleCats = useMemo(
    () =>
      fixedCategories(
        data.tickets,
        (ticket) => ticket.module,
        () => 1
      ),
    [data.tickets]
  )
  const clientCats = useMemo(
    () =>
      fixedCategories(
        data.tickets,
        (ticket) => ticket.client,
        () => 1
      ),
    [data.tickets]
  )
  const techCats = useMemo(
    () =>
      fixedCategories(
        data.activities,
        (activity) => activity.technician,
        (activity) => activity.hours
      ),
    [data.activities]
  )

  const insights = useMemo(() => buildInsights(data), [data])

  // Cada recorte é calculado ignorando a PRÓPRIA dimensão do gráfico: com
  // "Financeiro" ativo o gráfico de módulos segue mostrando os outros módulos,
  // senão sobraria uma barra e não haveria como trocar sem limpar antes.
  const kpis = useMemo(
    () =>
      crossKpis(filterTickets(data.tickets, filters), filterActivities(data.activities, filters)),
    [data, filters]
  )

  const rows = useMemo(() => filterTickets(data.tickets, filters), [data.tickets, filters])

  const statusSlices = useMemo(() => {
    const counts = countBy(filterTickets(data.tickets, filters, 'status'), (t) => t.status)
    return STATUS_CHART_ORDER.map((status) => ({
      key: status,
      label: data.statusMeta[status]?.label ?? status,
      value: counts.get(status) ?? 0,
      color: statusChartColor(status, isDark),
    }))
  }, [data, filters, isDark])

  const bucketTickets: SeriesPoint[] = useMemo(() => {
    const counts = countBy(filterTickets(data.tickets, filters, 'bucket'), (t) => t.bucket)
    return data.buckets.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      value: counts.get(bucket.key) ?? 0,
    }))
  }, [data, filters])

  const bucketHours: SeriesPoint[] = useMemo(() => {
    const hours = sumBy(
      filterActivities(data.activities, filters, 'bucket'),
      (activity) => activity.bucket,
      (activity) => activity.hours
    )
    return data.buckets.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      value: hours.get(bucket.key) ?? 0,
    }))
  }, [data, filters])

  const trendTickets: SeriesPoint[] = data.trend.map((point) => ({
    key: `${point.year}-${point.month}`,
    label: point.label,
    value: point.tickets,
  }))
  const trendHours: SeriesPoint[] = data.trend.map((point) => ({
    key: `${point.year}-${point.month}`,
    label: point.label,
    value: point.hours,
  }))

  function barItems(
    values: Map<string, number>,
    categories: string[],
    valueLabel?: (value: number) => string
  ): BarListItem[] {
    return categories.map((category) => {
      const value = values.get(category) ?? 0
      return {
        key: category,
        label: category,
        value,
        valueLabel: valueLabel?.(value),
      }
    })
  }

  const moduleItems = barItems(
    countBy(filterTickets(data.tickets, filters, 'module'), (t) => t.module),
    moduleCats
  )
  const clientItems = barItems(
    countBy(filterTickets(data.tickets, filters, 'client'), (t) => t.client),
    clientCats
  )
  const techItems = barItems(
    sumBy(
      filterActivities(data.activities, filters, 'tech'),
      (activity) => activity.technician,
      (activity) => activity.hours
    ),
    techCats,
    (value) => `${formatDecimal(value)} h`
  )

  const chips: FilterChip[] = (Object.keys(DIMENSION_LABELS) as FilterDimension[])
    .filter((dimension) => filters[dimension] !== null)
    .map((dimension) => {
      const raw = filters[dimension] as string
      const readable =
        dimension === 'status'
          ? (data.statusMeta[raw]?.label ?? raw)
          : dimension === 'bucket'
            ? (data.buckets.find((bucket) => bucket.key === raw)?.label ?? raw)
            : raw
      return { key: dimension, dimension: DIMENSION_LABELS[dimension], value: readable }
    })

  // Zero com casa decimal ("0,0 h") no traço do eixo é ruído; e acima de 100 a
  // casa decimal não acrescenta nada que o leitor use.
  const hours = (value: number) =>
    value === 0 ? '0 h' : `${formatDecimal(value, value >= 100 ? 0 : 1)} h`

  return (
    <View style={[styles.dashboard, stale && styles.stale]}>
      {chips.length > 0 && (
        <FilterChips
          chips={chips}
          onRemove={(key) =>
            onToggle(key as FilterDimension, filters[key as FilterDimension] ?? '')
          }
          onClearAll={onClearFilters}
        />
      )}

      <InsightBanner insights={insights} />

      {/* Os indicadores do recorte corrente. Mudam a cada clique nos gráficos —
          é isso que amarra o filtro ao número, e não só ao desenho. */}
      <View style={styles.tiles}>
        <StatTile
          hero
          accent={theme.chartMagnitude}
          label="Chamados no recorte"
          value={formatInteger(kpis.totalTickets)}
          hint={chips.length > 0 ? 'com o recorte ativo' : data.periodLabel}
        />
        <StatTile
          accent={statusChartColor('resolvido', isDark)}
          label="Taxa de conclusão"
          value={
            kpis.totalTickets === 0
              ? '—'
              : `${Math.round((kpis.concludedTickets / kpis.totalTickets) * 100)}%`
          }
          hint={`${formatInteger(kpis.concludedTickets)} ${
            kpis.concludedTickets === 1 ? 'concluído' : 'concluídos'
          }`}
        />
        <StatTile
          accent={statusChartColor('aberto', isDark)}
          label="Pendentes"
          value={formatInteger(kpis.pendingTickets)}
          hint="em aberto ou em andamento"
        />
        <StatTile
          accent={statusChartColor('em_andamento', isDark)}
          label="Horas trabalhadas"
          value={`${formatDecimal(kpis.totalHours)} h`}
          hint={
            kpis.hoursPerTicket === null
              ? 'sem chamados no recorte'
              : `média de ${formatDecimal(kpis.hoursPerTicket)} h/chamado`
          }
        />
        <StatTile
          accent={theme.chartMagnitude}
          label="1ª resposta média"
          value={
            kpis.averageFirstResponseHours === null
              ? '—'
              : `${formatDecimal(kpis.averageFirstResponseHours)} h`
          }
          // O indicador é preservado como o legado calcula, e o legado subtrai
          // hora de parede de instante UTC — o valor sai ~3h menor que o real.
          // Dizer isso na tela é mais honesto do que exibir um número que a
          // operação já usa como referência sem saber da distorção.
          hint="até a 1ª atividade; cálculo herdado subestima"
        />
        <StatTile
          accent={theme.muted}
          label="Idade média (abertos)"
          value={
            kpis.averageOpenAgeDays === null ? '—' : `${formatDecimal(kpis.averageOpenAgeDays)} d`
          }
          hint="chamados não concluídos"
        />
      </View>

      {/* Fileira de contrato: NÃO responde ao período nem ao recorte. O fundo
          recessivo é o que diz isso antes de a pessoa comparar e estranhar. */}
      <View style={styles.tiles}>
        <StatTile
          muted
          label="Backlog em aberto (geral)"
          value={formatInteger(data.backlog.total)}
          hint={
            data.backlog.total > 0
              ? `mais antigo há ${formatInteger(data.backlog.oldestDays)} ${
                  data.backlog.oldestDays === 1 ? 'dia' : 'dias'
                }${data.backlog.oldestTicketId ? ` (#${data.backlog.oldestTicketId})` : ''}`
              : 'nenhum chamado pendente'
          }
        />
        <StatTile
          muted
          label="Banco de horas acumulado"
          value={`${formatDecimal(data.accumulatedHours)} h`}
          hint={`ciclo ${data.cycleStartLabel} a ${data.cycleEndLabel}`}
        />
        <StatTile
          muted
          label="Horas pagas no período"
          value={`${formatDecimal(data.paidHoursInPeriod)} h`}
          hint="pagamentos registrados no período"
        />
        <StatTile
          muted
          label="Franquia mensal"
          value={`${formatDecimal(data.monthlyHoursAllowance)} h`}
          hint="horas contratadas por mês"
        />
      </View>

      <View style={[styles.grid, wide && styles.gridWide]}>
        <ChartCard
          title="Situação dos chamados"
          subtitle="Toque numa situação para recortar"
          basis={wide ? 300 : undefined}
        >
          <DonutChart
            slices={statusSlices}
            centerLabel="chamados"
            selectedKey={filters.status}
            onSelect={(key) => onToggle('status', key)}
          />
        </ChartCard>

        <ChartCard
          title={
            data.bucketMode === 'day'
              ? 'Ritmo do período, dia a dia'
              : 'Ritmo do período, mês a mês'
          }
          subtitle="Duas escalas: chamados à esquerda, horas à direita"
          basis={wide ? 480 : undefined}
        >
          <ComboTimeSeries
            countPoints={bucketTickets}
            countLabel="Chamados abertos"
            countAxisLabel="Chamados"
            countColor={theme.chartMagnitude}
            formatCount={formatInteger}
            amountPoints={bucketHours}
            amountLabel="Horas trabalhadas"
            amountAxisLabel="Horas"
            amountColor={theme.chartSecondary}
            formatAmount={hours}
            selectedKey={filters.bucket}
            onSelect={(key) => onToggle('bucket', key)}
          />
        </ChartCard>
      </View>

      <ChartCard
        title="Tendência — últimos 12 meses"
        subtitle="Fora do recorte: toque num mês para abrir o painel daquele mês"
      >
        <ComboTimeSeries
          countPoints={trendTickets}
          countLabel="Chamados abertos"
          countAxisLabel="Chamados"
          countColor={theme.chartMagnitude}
          formatCount={formatInteger}
          amountPoints={trendHours}
          amountLabel="Horas trabalhadas"
          amountAxisLabel="Horas"
          amountColor={theme.chartSecondary}
          formatAmount={hours}
          onSelect={(key) => {
            const [pickedYear, pickedMonth] = key.split('-').map(Number)
            onPickMonth(pickedYear, pickedMonth)
          }}
        />
      </ChartCard>

      <View style={[styles.grid, wide && styles.gridWide]}>
        <ChartCard
          title="Chamados por módulo"
          subtitle="Toque para recortar"
          basis={wide ? 330 : undefined}
        >
          <BarList
            items={moduleItems}
            selectedKey={filters.module}
            onSelect={(key) => onToggle('module', key)}
          />
        </ChartCard>

        <ChartCard
          title="Horas por técnico"
          subtitle="Toque para recortar"
          basis={wide ? 330 : undefined}
        >
          <BarList
            items={techItems}
            selectedKey={filters.tech}
            onSelect={(key) => onToggle('tech', key)}
          />
        </ChartCard>

        {!isClient && (
          <ChartCard
            title="Chamados por cliente"
            subtitle="Toque para recortar"
            basis={wide ? 330 : undefined}
          >
            <BarList
              items={clientItems}
              selectedKey={filters.client}
              onSelect={(key) => onToggle('client', key)}
            />
          </ChartCard>
        )}
      </View>

      {/* A tabela é o gêmeo textual dos gráficos: todo valor que um tooltip
          mostra também está aqui, sem depender de passar o cursor. */}
      <Card>
        <View style={styles.tableHead}>
          <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.textPrimary }]}>
            Chamados do recorte
          </Text>
          <Text style={[styles.tableCount, { color: theme.textSecondary }]}>
            {formatInteger(rows.length)} {rows.length === 1 ? 'chamado' : 'chamados'}
          </Text>
        </View>

        {rows.length === 0 ? (
          <Text style={[styles.emptyRow, { color: theme.textSecondary }]}>
            Nenhum chamado com o recorte atual.
          </Text>
        ) : (
          <>
            {rows.slice(0, TABLE_LIMIT).map((ticket) => (
              <Pressable
                key={ticket.id}
                accessibilityRole="button"
                accessibilityLabel={`Abrir chamado ${ticket.id}: ${ticket.title}. ${ticket.statusLabel}.`}
                onPress={() => onOpenTicket(ticket.id)}
                style={[styles.ticketRow, { borderTopColor: theme.border }]}
              >
                <View
                  style={[
                    styles.ticketMark,
                    { backgroundColor: statusChartColor(ticket.status, isDark) },
                  ]}
                />
                <View style={styles.ticketMain}>
                  <Text style={[styles.ticketId, { color: theme.muted }]}>
                    #{ticket.id} · {ticket.createdLabel} · {ticket.statusLabel}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[styles.ticketTitle, { color: theme.textPrimary }]}
                  >
                    {ticket.title}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.ticketMeta, { color: theme.textSecondary }]}
                  >
                    {ticket.client} · {ticket.module} · {ticket.technician}
                  </Text>
                </View>
                <Text style={[styles.ticketHours, { color: theme.textPrimary }]}>
                  {formatDecimal(ticket.hours)} h
                </Text>
              </Pressable>
            ))}

            {rows.length > TABLE_LIMIT && (
              <Text style={[styles.tableFoot, { color: theme.muted }]}>
                Mostrando os {TABLE_LIMIT} mais recentes de {formatInteger(rows.length)}. Recorte
                mais o painel para reduzir a lista.
              </Text>
            )}
          </>
        )}
      </Card>
    </View>
  )
}

interface ChartCardProps {
  title: string
  subtitle?: string
  /** Largura mínima antes de a grade quebrar a linha. */
  basis?: number
  children: React.ReactNode
}

function ChartCard({ title, subtitle, basis, children }: ChartCardProps) {
  const theme = useTheme()
  return (
    <Card style={basis === undefined ? undefined : { flexGrow: 1, flexBasis: basis, minWidth: 0 }}>
      <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.textPrimary }]}>
        {title}
      </Text>
      {subtitle && <Text style={[styles.cardSubtitle, { color: theme.muted }]}>{subtitle}</Text>}
      <View style={styles.cardBody}>{children}</View>
    </Card>
  )
}

const styles = StyleSheet.create({
  dashboard: { gap: 16 },
  // Recarga mantém o quadro: o painel anterior fica visível e só perde peso.
  stale: { opacity: 0.55 },
  filters: { flexDirection: 'row', columnGap: 12 },
  filterField: { flex: 1, minWidth: 0 },
  filterFoot: { gap: 2 },
  periodLabel: { fontSize: 14, fontWeight: '600' },
  filterHint: { fontSize: 12 },
  loading: { gap: 16 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  grid: { gap: 16 },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSubtitle: { fontSize: 12, marginTop: 2 },
  cardBody: { marginTop: 16 },
  tableHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 6,
  },
  tableCount: { fontSize: 13, fontVariant: ['tabular-nums'] },
  emptyRow: { fontSize: 14, paddingVertical: 8 },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  // Marca de situação: a cor acompanha o rótulo em texto na linha acima, nunca
  // sozinha — é a compensação obrigatória do contraste baixo do amarelo.
  ticketMark: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  ticketMain: { flex: 1, gap: 2 },
  ticketId: { fontSize: 12 },
  ticketTitle: { fontSize: 15, fontWeight: '600' },
  ticketMeta: { fontSize: 12 },
  ticketHours: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tableFoot: { fontSize: 12, paddingTop: 12, lineHeight: 17 },
})
