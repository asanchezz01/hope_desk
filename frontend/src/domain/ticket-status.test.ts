import { isTicketStatus, statusColor, statusLabel, TICKET_STATUS_META } from './ticket-status'

describe('domínio de status', () => {
  it('usa os mesmos rótulos do legado', () => {
    expect(statusLabel('aberto')).toBe('Em aberto')
    expect(statusLabel('em_andamento')).toBe('Em andamento')
    expect(statusLabel('resolvido')).toBe('Concluído')
    expect(statusLabel('fechado')).toBe('Fechado')
  })

  it('reproduz o Title Case do legado para status desconhecido, sem erro', () => {
    // `normalize_status` do Flask é tolerante: nunca lança, mesmo com valor
    // inesperado vindo do banco.
    expect(statusLabel('aguardando_cliente')).toBe('Aguardando Cliente')
    expect(statusLabel('qualquer')).toBe('Qualquer')
  })

  it('espelha exatamente as cores de ANALYTICS_STATUS_META do backend', () => {
    // Divergir aqui faria a lista de chamados e o gráfico de status mostrarem
    // cores diferentes para o mesmo estado.
    expect(TICKET_STATUS_META).toEqual({
      aberto: { label: 'Em aberto', color: '#b03a3a' },
      em_andamento: { label: 'Em andamento', color: '#a2600b' },
      resolvido: { label: 'Concluído', color: '#0d7f57' },
      fechado: { label: 'Fechado', color: '#1f5fe0' },
    })
  })

  it('devolve um cinza neutro para status fora do domínio', () => {
    expect(statusColor('aberto')).toBe('#b03a3a')
    expect(statusColor('inexistente')).toBe('#576d84')
  })

  it('reconhece apenas os quatro status do domínio', () => {
    expect(isTicketStatus('aberto')).toBe(true)
    expect(isTicketStatus('ABERTO')).toBe(false)
    expect(isTicketStatus(null)).toBe(false)
  })
})
