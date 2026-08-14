import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { Ticket } from '../../api/tickets'
import { formatInstantLabel } from '../../domain/wall-clock'
import { useTheme } from '../../theme/ThemeContext'
import StatusBadge from '../StatusBadge'

interface TicketCardProps {
  ticket: Ticket
  onPress: () => void
  /** Cliente não precisa ver o próprio nome repetido em toda linha da lista. */
  showClient?: boolean
}

export default function TicketCard({ ticket, onPress, showClient = true }: TicketCardProps) {
  const theme = useTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Chamado ${ticket.id}: ${ticket.title}. ${ticket.statusLabel}.`}
      accessibilityHint="Abre o detalhe do chamado"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.cardBg, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.id, { color: theme.muted }]}>#{ticket.id}</Text>
        <StatusBadge status={ticket.status} label={ticket.statusLabel} />
      </View>

      <Text numberOfLines={2} style={[styles.title, { color: theme.textPrimary }]}>
        {ticket.title}
      </Text>

      <View style={styles.meta}>
        {showClient && (
          <Text style={[styles.metaItem, { color: theme.textSecondary }]} numberOfLines={1}>
            {ticket.client.name}
          </Text>
        )}
        {ticket.systemModule && (
          <Text style={[styles.metaItem, { color: theme.textSecondary }]} numberOfLines={1}>
            {ticket.systemModule.name}
            {/* Módulo desativado continua ligado a chamados antigos, que seguem
                editáveis — sinalizar evita a impressão de dado inconsistente. */}
            {!ticket.systemModule.isActive && ' (inativo)'}
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerItem, { color: theme.muted }]}>
          {/* createdAt é instante UTC: converter para o fuso do aparelho é o
              comportamento correto aqui, ao contrário das atividades. */}
          {formatInstantLabel(ticket.createdAt)}
        </Text>
        <Text style={[styles.footerItem, { color: theme.muted }]}>
          {ticket.technician ? ticket.technician.name : 'Sem técnico'}
          {ticket.activityCount > 0 &&
            ` · ${ticket.activityCount} ${ticket.activityCount === 1 ? 'atividade' : 'atividades'}`}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 14, borderWidth: 1, borderRadius: 12 },
  pressed: { opacity: 0.85 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  id: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { fontSize: 13 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerItem: { fontSize: 12 },
})
