import React, { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import BarList, { type BarListItem } from '../src/components/BarList'
import Card from '../src/components/Card'
import ErrorState from '../src/components/ErrorState'
import Select from '../src/components/Select'
import Skeleton from '../src/components/Skeleton'
import StatTile from '../src/components/StatTile'
import StatusBreakdown from '../src/components/StatusBreakdown'
import TrendChart from '../src/components/TrendChart'
import { useAuth } from '../src/context/AuthProvider'
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
          <View style={styles.tiles}>
            <StatTile label="Chamados" value={formatInteger(data.kpis.totalTickets)} />
            <StatTile
              label="Concluídos"
              value={formatInteger(data.kpis.concludedTickets)}
              hint={`${formatInteger(data.kpis.openTickets)} em aberto`}
            />
            <StatTile label="Horas no período" value={formatHours(data.kpis.totalHours)} />
            <StatTile
              label="Média por chamado"
              value={formatHours(data.kpis.averageHoursPerTicket)}
              hint={`${formatInteger(data.kpis.ticketsWithActivity)} com atividade`}
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
            <SectionTitle>Fila pendente</SectionTitle>
            <View style={styles.tiles}>
              <StatTile label="Em aberto ou andamento" value={formatInteger(data.backlog.total)} />
              <StatTile
                label="Mais antigo"
                value={`${formatInteger(data.backlog.oldestDays)} d`}
                hint={
                  data.backlog.oldestTicketId
                    ? `Chamado #${data.backlog.oldestTicketId}`
                    : 'Nenhum pendente'
                }
              />
              <StatTile
                label="1ª resposta (média)"
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
                hint="Cálculo herdado do sistema antigo; tende a subestimar"
              />
            </View>
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
            <SectionTitle>Banco de horas</SectionTitle>
            <View style={styles.tiles}>
              <StatTile
                label="Saldo do ciclo"
                value={formatHours(data.accumulatedHours)}
                hint={`${data.cycleStartLabel} a ${data.cycleEndLabel}`}
              />
              <StatTile label="Franquia mensal" value={formatHours(data.monthlyHoursAllowance)} />
              <StatTile
                label="Horas pagas no período"
                value={formatHours(data.paidHoursInPeriod)}
              />
            </View>
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
  filters: { gap: 0 },
  filtersWide: { flexDirection: 'row', gap: 12 },
  filterField: { flexGrow: 1, flexBasis: 200 },
  periodLabel: { fontSize: 13 },
  loading: { gap: 16 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
})
