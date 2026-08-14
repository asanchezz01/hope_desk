import type { ApiUser } from '../api/client'

import type { NavItem } from './AppShell'

/**
 * Itens de navegação por perfil.
 *
 * `visible` só evita mostrar caminho que resultaria em 403 — não é
 * autorização. A API recusa por conta própria, e as rotas de analytics e
 * administração chegam nas Fases 10.
 */
export function navItemsFor(user: ApiUser | null): NavItem[] {
  const isTechnician = user?.role === 'technician'
  const isSuperuser = user?.isSuperuser ?? false

  return [
    { href: '/', label: 'Chamados' },
    { href: '/analytics', label: 'Indicadores', visible: isTechnician || isSuperuser },
    { href: '/admin', label: 'Administração', visible: isSuperuser },
  ]
}
