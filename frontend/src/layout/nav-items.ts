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
    { href: '/', label: 'Chamados' },
    { href: '/analytics', label: 'Indicadores' },
    { href: '/reports', label: 'Relatórios' },
    { href: '/admin', label: 'Administração', visible: isTechnician || isSuperuser },
  ]
}
