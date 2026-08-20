import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { toMessage } from '../src/api/to-message'
import BarList from '../src/components/BarList'
import Button from '../src/components/Button'
import Card from '../src/components/Card'
import DateField from '../src/components/DateField'
import EmptyState from '../src/components/EmptyState'
import ErrorState from '../src/components/ErrorState'
import Select from '../src/components/Select'
import Skeleton from '../src/components/Skeleton'
import StatTile from '../src/components/StatTile'
import StatusBadge from '../src/components/StatusBadge'
import { useToast } from '../src/components/Toast'
import { useAuth } from '../src/context/AuthProvider'
import { firstDayOfMonthIso, formatDecimal, formatHours, todayIsoDate } from '../src/domain/format'
import { MONTHS_PT } from '../src/domain/months'
import { statusKeyFromRaw } from '../src/domain/ticket-status'
import { useActivityReport, useReportPdf, useServicesReport } from '../src/hooks/useReports'
import AppShell from '../src/layout/AppShell'
import { navItemsFor } from '../src/layout/nav-items'
import { useBreakpoint } from '../src/layout/useBreakpoint'
import { useIsDark, useTheme } from '../src/theme/ThemeContext'
import { statusChartColor } from '../src/theme/chart-palette'

type Tab = 'activities' | 'services'

export default function Reports() {
  const { user } = useAuth()
  const { isMobile } = useBreakpoint()
  const toast = useToast()
  const theme = useTheme()

  const [tab, setTab] = useState<Tab>('activities')
  const [{ currentYear, currentMonth }] = useState(() => {
    const now = new Date()
    return { currentYear: now.getFullYear(), currentMonth: now.getMonth() + 1 }
  })

  const [start, setStart] = useState(() => firstDayOfMonthIso())
  const [end, setEnd] = useState(() => todayIsoDate())
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)

  const activityReport = useActivityReport({ start, end }, tab === 'activities')
  const servicesReport = useServicesReport({ year, month }, tab === 'services')
  const pdf = useReportPdf()

  async function downloadPdf() {
    try {
      if (tab === 'activities') {
        await pdf.mutateAsync({
          source: 'activities',
          params: { start, end },
          fallbackName: `relatorio-atividades-${start}-a-${end}.pdf`,
        })
      } else {
        await pdf.mutateAsync({
          source: 'services',
          params: { year, month },
          fallbackName: `demonstrativo-servicos-${year}-${String(month).padStart(2, '0')}.pdf`,
        })
      }
      toast.show('Relatório gerado.', 'success')
    } catch (caught) {
      toast.show(toMessage(caught), 'error')
    }
  }

  const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear - index).map((value) => ({
    value,
    label: String(value),
  }))

  return (
    <AppShell title="Relatórios" navItems={navItemsFor(user)} width="wide">
      <Card accent={theme.primary}>
        <View accessibilityRole="tablist" style={styles.tabs}>
          <TabButton
            label="Atividades por período"
            selected={tab === 'activities'}
            onPress={() => setTab('activities')}
          />
          <TabButton
            label="Demonstrativo mensal"
            selected={tab === 'services'}
            onPress={() => setTab('services')}
          />
        </View>

        <View style={[styles.filters, !isMobile && styles.filtersWide]}>
          {tab === 'activities' ? (
            <>
              <View style={!isMobile ? styles.filterField : undefined}>
                <DateField label="Início" value={start} onChange={setStart} />
              </View>
              <View style={!isMobile ? styles.filterField : undefined}>
                {/* O legado trata a data final como INCLUSIVA; dizer isso evita
                    a dúvida de "preciso pôr o dia seguinte?". */}
                <DateField
                  label="Fim"
                  value={end}
                  onChange={setEnd}
                  hint="A data final entra no relatório."
                />
              </View>
            </>
          ) : (
            <>
              <View style={!isMobile ? styles.filterField : undefined}>
                <Select label="Ano" value={year} options={yearOptions} onChange={setYear} />
              </View>
              <View style={!isMobile ? styles.filterField : undefined}>
                <Select
                  label="Mês"
                  value={month}
                  options={MONTHS_PT.map((item) => ({ value: item.value, label: item.label }))}
                  onChange={setMonth}
                />
              </View>
            </>
          )}
        </View>

        <View style={styles.actions}>
          <Button
            title={pdf.isPending ? 'Gerando…' : 'Baixar PDF'}
            icon="file-pdf"
            onPress={() => void downloadPdf()}
            loading={pdf.isPending}
          />
        </View>
      </Card>

      {tab === 'activities' ? (
        <ActivityReportView report={activityReport} />
      ) : (
        <ServicesReportView report={servicesReport} />
      )}
    </AppShell>
  )
}

function TabButton({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  const theme = useTheme()
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.tab,
        { borderColor: selected ? theme.primary : theme.border },
        selected && { backgroundColor: theme.background },
      ]}
    >
      <Text
        style={[
          styles.tabLabel,
          { color: selected ? theme.textPrimary : theme.textSecondary },
          selected && styles.tabLabelSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

type ActivityQuery = ReturnType<typeof useActivityReport>

function ActivityReportView({ report }: { report: ActivityQuery }) {
  const theme = useTheme()
  const isDark = useIsDark()

  if (report.isError && !report.data) {
    return (
      <Card accent={theme.danger}>
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      </Card>
    )
  }
  if (!report.data) {
    return (
      <Card accent={theme.chartMagnitude}>
        <Skeleton height={120} radius={12} />
      </Card>
    )
  }

  const data = report.data

  return (
    <>
      <Card accent={theme.chartMagnitude}>
        <View style={styles.tiles}>
          <StatTile
            label="Total de horas"
            value={formatHours(data.totalHours)}
            hint={`${data.periodStartLabel} a ${data.periodEndLabel}`}
            accent={theme.chartMagnitude}
          />
          <StatTile
            label="Chamados"
            value={String(data.tickets.length)}
            accent={theme.chartSecondary}
          />
        </View>
      </Card>

      {data.totalsByTechnician.length > 0 && (
        <Card accent={theme.chartMagnitude}>
          <Text
            accessibilityRole="header"
            style={[styles.sectionTitle, { color: theme.textPrimary }]}
          >
            Horas por técnico
          </Text>
          <BarList
            items={data.totalsByTechnician.map((row) => ({
              key: row.technicianName,
              label: row.technicianName,
              value: row.hours,
              valueLabel: `${formatDecimal(row.hours)} h`,
            }))}
          />
        </Card>
      )}

      {data.tickets.length === 0 ? (
        <Card accent={theme.muted}>
          <EmptyState
            title="Nenhuma atividade no período"
            description="Ajuste o intervalo de datas para ver os lançamentos."
          />
        </Card>
      ) : (
        data.tickets.map((ticket) => {
          // O card é pintado por status — a leitura rápida da fila. Como a cor
          // não pode ser a ÚNICA portadora do estado, o `StatusBadge` repete o
          // rótulo ao lado da faixa (a cor é atalho, não definição).
          // `StatusBadge` e `statusChartColor` esperam a CHAVE, mas o
          // relatório devolve o rótulo: `statusKeyFromRaw` normaliza.
          const statusKey = statusKeyFromRaw(ticket.status)
          const statusAccent = statusKey
            ? statusChartColor(statusKey, isDark)
            : theme.chartSecondary
          return (
            <Card key={ticket.ticketId} accent={statusAccent}>
              <View style={styles.ticketHeader}>
                <Text style={[styles.ticketTitle, { color: theme.textPrimary }]}>
                  #{ticket.ticketId} · {ticket.title}
                </Text>
                {statusKey ? <StatusBadge status={statusKey} /> : null}
              </View>
              <Text style={[styles.ticketMeta, { color: theme.muted }]}>
                {ticket.clientName} · {ticket.moduleName} · {formatHours(ticket.totalHours)}
              </Text>
              {ticket.activities.map((activity, index) => (
                <View
                  key={`${ticket.ticketId}-${index}`}
                  style={[styles.activityRow, { borderTopColor: theme.border }]}
                >
                  <Text style={[styles.activityNotes, { color: theme.textSecondary }]}>
                    {activity.notes}
                  </Text>
                  <Text style={[styles.activityMeta, { color: theme.muted }]}>
                    {activity.startedLabel} — {activity.endedLabel} · {formatHours(activity.hours)}{' '}
                    · {activity.technicianName}
                  </Text>
                </View>
              ))}
            </Card>
          )
        })
      )}
    </>
  )
}

type ServicesQuery = ReturnType<typeof useServicesReport>

function ServicesReportView({ report }: { report: ServicesQuery }) {
  const theme = useTheme()

  if (report.isError && !report.data) {
    return (
      <Card accent={theme.danger}>
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      </Card>
    )
  }
  if (!report.data) {
    return (
      <Card accent={theme.chartMagnitude}>
        <Skeleton height={120} radius={12} />
      </Card>
    )
  }

  const data = report.data

  return (
    <>
      <Card accent={theme.chartMagnitude}>
        <View style={styles.tiles}>
          <StatTile
            label="Total de horas"
            value={formatHours(data.totalHours)}
            hint={data.periodLabel}
            accent={theme.chartMagnitude}
          />
          <StatTile
            label="Lançamentos"
            value={String(data.rows.length)}
            accent={theme.chartSecondary}
          />
        </View>
      </Card>

      <Card accent={theme.chartSecondary}>
        {data.rows.length === 0 ? (
          <EmptyState
            title="Sem lançamentos no mês"
            description="Escolha outro mês para ver o demonstrativo."
          />
        ) : (
          data.rows.map((row, index) => (
            <View
              key={`${row.ticketId}-${index}`}
              style={[
                styles.serviceRow,
                index > 0 && { borderTopColor: theme.border, borderTopWidth: 1 },
              ]}
            >
              <Text style={[styles.serviceTitle, { color: theme.textPrimary }]}>
                #{row.ticketId} · {row.title}
              </Text>
              <Text style={[styles.serviceService, { color: theme.textSecondary }]}>
                {row.service}
              </Text>
              <Text style={[styles.serviceMeta, { color: theme.muted }]}>
                {row.lastActivityLabel} · {row.clientName} · {row.technicianName} ·{' '}
                {formatHours(row.hours)}
              </Text>
            </View>
          ))
        )}
      </Card>
    </>
  )
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  tab: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabLabel: { fontSize: 13 },
  tabLabelSelected: { fontWeight: '700' },
  filters: { gap: 0 },
  filtersWide: { flexDirection: 'row', gap: 12 },
  // Só vale na LINHA: num contêiner em coluna (celular) `flexBasis` é
  // ALTURA, e cada campo viraria uma caixa dessa altura. Por isso o
  // estilo é aplicado condicionalmente, como em `analytics`.
  filterField: { flexGrow: 1, flexBasis: 180, minWidth: 0, maxWidth: 300 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  ticketTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  ticketMeta: { fontSize: 12, marginTop: 2 },
  activityRow: { paddingTop: 10, marginTop: 10, borderTopWidth: 1, gap: 3 },
  activityNotes: { fontSize: 14, lineHeight: 19 },
  activityMeta: { fontSize: 12 },
  serviceRow: { paddingVertical: 10, gap: 3 },
  serviceTitle: { fontSize: 14, fontWeight: '600' },
  serviceService: { fontSize: 13, lineHeight: 18 },
  serviceMeta: { fontSize: 12 },
})
