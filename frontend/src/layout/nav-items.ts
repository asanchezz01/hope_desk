import type { ApiUser } from '../api/client'

import type { NavItem } from './AppShell'

/**
 * Itens de navegação por perfil.
 *
 * `visible` só evita mostrar caminho que resultaria em 403 — não é
 * autorização. A API recusa por conta própria.
 *
 * Conferido nos controllers, porque a intuição erra aqui:
 *
 *   /analytics → SEM `@Roles`. Cliente acessa; o service aplica
 *                `scopedTicketWhere`, que filtra por `clientId`. Ele vê os
 *                indicadores dos próprios chamados.
 *   /reports   → SEM `@Roles`, pelo mesmo motivo. O legado gera PDF para
 *                qualquer perfil, e é por isso que `/parameters/public` é
 *                liberado — o cabeçalho da empresa entra em todo relatório.
 *   /admin     → módulos, parâmetros e pagamentos exigem `@RequiresSuperuser()`.
 *                Gestão de usuários é a exceção: `@Roles('technician')`.
 */
export function navItemsFor(user: ApiUser | null): NavItem[] {
  const isTechnician = user?.role === 'technician'
  const isSuperuser = user?.isSuperuser ?? false

  return [
    { href: '/analytics', label: 'Painel' },
    { href: '/', label: 'Chamados' },
    { href: '/reports', label: 'Relatórios' },
    { href: '/admin', label: 'Administração', visible: isTechnician || isSuperuser },
  ]
}

export interface MenuItem extends NavItem {
  /** Ação destrutiva ou de saída: destacada e sempre no fim. */
  danger?: boolean
}

/**
 * Itens do menu completo — o equivalente do `top-actions-menu` do legado.
 *
 * ## Por que existe, além da navegação lateral
 *
 * A lateral só aparece a partir de 768px (`useBreakpoint`). **No celular não
 * havia navegação nenhuma**: quem entrava pelo telefone caía na primeira tela
 * e não tinha como sair dela — nem para o painel, nem para trocar a senha, nem
 * para as telas administrativas. O legado nunca teve esse buraco: o menu
 * sanduíche estava em toda largura, com a lista inteira dentro.
 *
 * A ordem e os rótulos seguem o legado, inclusive as três telas
 * administrativas em separado — no legado elas eram links diretos, e escondê-las
 * atrás de um índice acrescenta um passo que ninguém pediu.
 */
export function menuItemsFor(user: ApiUser | null): MenuItem[] {
  const isTechnician = user?.role === 'technician'
  const isSuperuser = user?.isSuperuser ?? false

  return [
    { href: '/analytics', label: 'Painel de Indicadores' },
    { href: '/', label: 'Chamados' },
    { href: '/reports', label: 'Relatórios' },
    { href: '/admin/parameters', label: 'Parâmetros da Empresa', visible: isSuperuser },
    { href: '/admin/modules', label: 'Módulos do Sistema', visible: isSuperuser },
    { href: '/admin/payments', label: 'Cadastro de Pagamentos', visible: isSuperuser },
    { href: '/admin/users', label: 'Gerenciar Usuários', visible: isTechnician || isSuperuser },
    { href: '/change-password', label: 'Alterar Senha' },
  ]
}
