import { useRouter } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import BarList, { type BarListItem } from '../src/components/BarList'
import Card from '../src/components/Card'
import ErrorState from '../src/components/ErrorState'
import Select from '../src/components/Select'
import Skeleton from '../src/components/Skeleton'
import StatTile from '../src/components/StatTile'
import StatusBreakdown from '../src/components/StatusBreakdown'
import TrendChart from '../src/components/TrendChart'
import { useAuth } from '../src/context/AuthProvider'
import { averageOpenAgeDays, bucketSeries, completionRate } from '../src/domain/analytics-kpis'
import { formatDecimal, formatHours, formatInteger } from '../src/domain/format'
import { MONTHS_PT } from '../src/domain/months'
import { useAnalytics } from '../src/hooks/useAnalytics'
import AppShell from '../src/layout/AppShell'
import { navItemsFor } from '../src/layout/nav-items'
import { useBreakpoint } from '../src/layout/useBreakpoint'
import { useTheme } from '../src/theme/ThemeContext'
import { STATUS_CHART_ORDER } from '../src/theme/chart-palette'

/** Sentinelas dos seletores — o `Select` não aceita `null`. */
const ALL_PERIODS = 0
const WHOLE_YEAR = 0

export default function Analytics() {
  const theme = useTheme()
  const router = useRouter()
  const { user } = useAuth()
  const { isMobile } = useBreakpoint()

  const [{ currentYear, currentMonth }] = useState(() => {
    const now = new Date()
    return { currentYear: now.getFullYear(), currentMonth: now.getMonth() + 1 }
  })

  const [year, setYear] = useState<number>(currentYear)
  const [month, setMonth] = useState<number>(currentMonth)

  const params = useMemo(() => {
    if (year === ALL_PERIODS) return { allPeriods: true }
    if (month === WHOLE_YEAR) return { year }
    return { year, month }
  }, [year, month])

  const analytics = useAnalytics(params)
  const data = analytics.data

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

  function toBarItems(rows: { key: string; label: string; count: number }[]): BarListItem[] {
    return rows.map((row) => ({ key: row.key, label: row.label, value: row.count }))
  }

  if (analytics.isError && !data) {
    return (
      <AppShell title="Indicadores" navItems={navItemsFor(user)}>
        <ErrorState error={analytics.error} onRetry={() => void analytics.refetch()} />
      </AppShell>
    )
  }

  return (
    <AppShell title="Indicadores" navItems={navItemsFor(user)}>
      {/* Filtros numa linha só, acima dos gráficos. */}
      <Card>
        <View style={[styles.filters, !isMobile && styles.filtersWide]}>
          <View style={styles.filterField}>
            <Select label="Período" value={year} options={yearOptions} onChange={setYear} />
          </View>
          {year !== ALL_PERIODS && (
            <View style={styles.filterField}>
              <Select label="Mês" value={month} options={monthOptions} onChange={setMonth} />
            </View>
          )}
        </View>
        {data && (
          <Text style={[styles.periodLabel, { color: theme.textSecondary }]}>
            {data.periodLabel}
          </Text>
        )}
      </Card>

      {!data ? (
        <View style={styles.loading}>
          <Skeleton height={90} radius={12} />
          <Skeleton height={160} radius={12} />
          <Skeleton height={160} radius={12} />
        </View>
      ) : (
        <>
          {/* Os seis indicadores do período, na ordem do painel antigo. */}
          <View style={styles.tiles}>
            <StatTile
              label="Chamados no período"
              value={formatInteger(data.kpis.totalTickets)}
              hint={data.periodLabel}
            />
            <StatTile
              label="Taxa de conclusão"
              value={
                completionRate(data.kpis.concludedTickets, data.kpis.totalTickets) === null
                  ? '—'
                  : `${completionRate(data.kpis.concludedTickets, data.kpis.totalTickets)}%`
              }
              hint={`${formatInteger(data.kpis.concludedTickets)} ${
                data.kpis.concludedTickets === 1 ? 'concluído' : 'concluídos'
              }`}
            />
            <StatTile
              label="Pendentes no período"
              value={formatInteger(data.kpis.openTickets)}
              hint="em aberto ou em andamento"
            />
            <StatTile
              label="Horas trabalhadas"
              value={formatHours(data.kpis.totalHours)}
              hint={
                data.kpis.totalTickets > 0
                  ? `média de ${formatDecimal(data.kpis.averageHoursPerTicket)} h/chamado`
                  : `${formatInteger(data.kpis.ticketsWithActivity)} com atividade`
              }
            />
            <StatTile
              label="1ª resposta média"
              value={
                data.kpis.averageFirstResponseHours === null
                  ? '—'
                  : formatHours(data.kpis.averageFirstResponseHours)
              }
              // O indicador é preservado como o legado calcula, e o legado
              // subtrai hora de parede de instante UTC — o valor sai ~3h
              // menor que o real. Dizer isso na tela é mais honesto do que
              // exibir um número que a operação já usa como referência sem
              // saber da distorção.
              hint="do chamado à 1ª atividade; cálculo herdado, tende a subestimar"
            />
            <StatTile
              label="Idade média (abertos)"
              value={
                averageOpenAgeDays(data.tickets) === null
                  ? '—'
                  : `${formatDecimal(averageOpenAgeDays(data.tickets) as number)} d`
              }
              hint="chamados não concluídos"
            />
          </View>

          {/* Fileira estática: não muda com filtro de período, como no legado. */}
          <View style={styles.tiles}>
            <StatTile
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
              label="Banco de horas acumulado"
              value={formatHours(data.accumulatedHours)}
              hint={`ciclo ${data.cycleStartLabel} a ${data.cycleEndLabel}`}
            />
            <StatTile
              label="Horas pagas no período"
              value={formatHours(data.paidHoursInPeriod)}
              hint="pagamentos registrados no período"
            />
            <StatTile
              label="Franquia mensal"
              value={formatHours(data.monthlyHoursAllowance)}
              hint="horas contratadas por mês"
            />
          </View>

          <Card>
            <SectionTitle>Situação dos chamados</SectionTitle>
            <StatusBreakdown
              slices={STATUS_CHART_ORDER.map((status) => {
                const row = data.byStatus.find((item) => item.key === status)
                return {
                  key: status,
                  label: row?.label ?? data.statusMeta[status]?.label ?? status,
                  count: row?.count ?? 0,
                }
              })}
            />
          </Card>

          <Card>
            {/* O gráfico de atividades do legado: horas dentro do período
                selecionado, dia a dia num mês e mês a mês num ano. */}
            <SectionTitle>
              {data.bucketMode === 'day' ? 'Horas por dia do período' : 'Horas por mês do período'}
            </SectionTitle>
            <TrendChart measure="horas" points={bucketSeries(data)} />
          </Card>

          <Card>
            <SectionTitle>Chamados por mês</SectionTitle>
            <TrendChart
              measure="chamados"
              points={data.trend.map((point) => ({ label: point.label, value: point.tickets }))}
            />
          </Card>

          <Card>
            {/* Segundo gráfico, e não um segundo eixo no anterior: horas e
                chamados têm escalas diferentes, e sobrepô-los sugeriria uma
                correlação que o dado não tem. */}
            <SectionTitle>Horas por mês</SectionTitle>
            <TrendChart
              measure="horas"
              points={data.trend.map((point) => ({ label: point.label, value: point.hours }))}
            />
          </Card>

          <Card>
            <SectionTitle>Por módulo</SectionTitle>
            <BarList items={toBarItems(data.byModule)} />
          </Card>

          <Card>
            <SectionTitle>Por técnico</SectionTitle>
            <BarList items={toBarItems(data.byTechnician)} />
          </Card>

          <Card>
            <SectionTitle>Por cliente</SectionTitle>
            <BarList items={toBarItems(data.byClient)} />
          </Card>

          <Card>
            <SectionTitle>Horas por técnico</SectionTitle>
            <BarList
              items={data.byTechnician.map((row) => ({
                key: row.key,
                label: row.label,
                value: row.hours,
                valueLabel: `${formatDecimal(row.hours)} h`,
              }))}
            />
          </Card>

          {/* "Chamados do período" — a tabela que fechava o painel do legado.
              As linhas já vêm na mesma resposta; não há requisição extra. */}
          <Card>
            <SectionTitle>Chamados do período ({formatInteger(data.tickets.length)})</SectionTitle>
            {data.tickets.length === 0 ? (
              <Text style={[styles.emptyRow, { color: theme.textSecondary }]}>
                Nenhum chamado no período selecionado.
              </Text>
            ) : (
              data.tickets.map((ticket) => (
                <Pressable
                  key={ticket.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir chamado ${ticket.id}: ${ticket.title}. ${ticket.statusLabel}.`}
                  onPress={() => router.push(`/tickets/${ticket.id}` as never)}
                  style={[styles.ticketRow, { borderTopColor: theme.border }]}
                >
                  <View style={styles.ticketMain}>
                    <Text style={[styles.ticketId, { color: theme.textSecondary }]}>
                      #{ticket.id} · {ticket.createdLabel}
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
                  <View style={styles.ticketSide}>
                    <Text
                      style={[
                        styles.ticketStatus,
                        { color: data.statusMeta[ticket.status]?.color ?? theme.textSecondary },
                      ]}
                    >
                      {ticket.statusLabel}
                    </Text>
                    <Text style={[styles.ticketHours, { color: theme.textPrimary }]}>
                      {formatDecimal(ticket.hours)} h
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </Card>
        </>
      )}
    </AppShell>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const theme = useTheme()
  return (
    <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.textPrimary }]}>
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  emptyRow: { fontSize: 14, paddingVertical: 8 },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  ticketMain: { flex: 1, gap: 2 },
  ticketId: { fontSize: 12 },
  ticketTitle: { fontSize: 15, fontWeight: '600' },
  ticketMeta: { fontSize: 12 },
  ticketSide: { alignItems: 'flex-end', gap: 4 },
  ticketStatus: { fontSize: 12, fontWeight: '700' },
  ticketHours: { fontSize: 13, fontWeight: '600' },
  filters: { gap: 0 },
  filtersWide: { flexDirection: 'row', gap: 12 },
  filterField: { flexGrow: 1, flexBasis: 200 },
  periodLabel: { fontSize: 13 },
  loading: { gap: 16 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
})
