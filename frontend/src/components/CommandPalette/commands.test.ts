import { filterCommands, moveHighlight, normalizeText, type PaletteCommand } from './commands'

const COMMANDS: PaletteCommand[] = [
  { id: '/', label: 'Chamados', href: '/' },
  { id: '/tickets/new', label: 'Novo chamado', hint: 'Abrir solicitação', href: '/tickets/new' },
  { id: '/analytics', label: 'Painel', href: '/analytics' },
  { id: '/reports', label: 'Relatórios', href: '/reports' },
  { id: '/admin', label: 'Administração', href: '/admin' },
]

function labels(commands: PaletteCommand[]): string[] {
  return commands.map((command) => command.label)
}

describe('normalizeText', () => {
  it('remove acento e caixa', () => {
    expect(normalizeText('Relatórios')).toBe('relatorios')
    expect(normalizeText('ADMINISTRAÇÃO')).toBe('administracao')
  })

  it('não altera texto já normalizado', () => {
    expect(normalizeText('  painel  ')).toBe('painel')
  })
})

describe('filterCommands', () => {
  it('devolve tudo com a consulta vazia — a palette aberta precisa mostrar o que existe', () => {
    expect(filterCommands(COMMANDS, '')).toHaveLength(COMMANDS.length)
    expect(filterCommands(COMMANDS, '   ')).toHaveLength(COMMANDS.length)
  })

  it('acha o item mesmo sem o acento digitado', () => {
    expect(labels(filterCommands(COMMANDS, 'relatorios'))).toEqual(['Relatórios'])
    expect(labels(filterCommands(COMMANDS, 'administracao'))).toEqual(['Administração'])
  })

  it('aceita os termos fora de ordem', () => {
    expect(labels(filterCommands(COMMANDS, 'chamado novo'))).toEqual(['Novo chamado'])
  })

  it('busca também no texto de apoio', () => {
    expect(labels(filterCommands(COMMANDS, 'solicitacao'))).toEqual(['Novo chamado'])
  })

  it('devolve lista vazia quando nada corresponde', () => {
    expect(filterCommands(COMMANDS, 'inexistente')).toEqual([])
  })

  it('não devolve o mesmo array recebido — a lista da palette não pode alterar a origem', () => {
    const result = filterCommands(COMMANDS, '')
    expect(result).not.toBe(COMMANDS)
  })
})

describe('moveHighlight', () => {
  it('avança e volta dentro da lista', () => {
    expect(moveHighlight(0, 1, 3)).toBe(1)
    expect(moveHighlight(2, -1, 3)).toBe(1)
  })

  it('dá a volta nas duas pontas', () => {
    expect(moveHighlight(2, 1, 3)).toBe(0)
    expect(moveHighlight(0, -1, 3)).toBe(2)
  })

  it('devolve 0 com a lista vazia, em vez de -1', () => {
    // -1 renderizaria "nenhum item destacado" e o Enter não executaria nada,
    // mas o índice negativo também sobreviveria à próxima busca.
    expect(moveHighlight(0, -1, 0)).toBe(0)
    expect(moveHighlight(3, 1, 0)).toBe(0)
  })
})
