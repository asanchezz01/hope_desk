import type { FontAwesome6 } from '@expo/vector-icons'
import type { ComponentProps } from 'react'

import type { ApiUser } from '../api/client'

export interface NavItem {
  href: string
  label: string
  /** Nome do glyph no FontAwesome6 (estilo solid). */
  icon: ComponentProps<typeof FontAwesome6>['name']
  /** Ocultar quando o perfil não puder usar. Não é autorização — a API decide. */
  visible?: boolean
}

export interface MenuSection {
  /** `null` nos atalhos do dia a dia, que abrem o menu sem cabeçalho. */
  title: string | null
  items: NavItem[]
}

/**
 * Navegação da retaguarda, agrupada por assunto.
 *
 * ## Por que é uma lista só, e agrupada
 *
 * Antes havia DUAS navegações: uma coluna lateral com quatro atalhos e um menu
 * sanduíche com a lista inteira, e o sanduíche aparecia até no desktop, ao lado
 * da coluna. Eram dois modelos para o mesmo problema, e nenhum dos dois
 * completo. O padrão da retaguarda NewHope (HopeSell) tem uma navegação só: a
 * coluna carrega TODOS os destinos, agrupados em seções de três a cinco itens —
 * ler uma seção curta é mais rápido que varrer uma lista corrida — e no celular
 * essa mesma coluna vira gaveta pelo botão sanduíche.
 *
 * ## `visible` não é autorização
 *
 * Só evita mostrar caminho que resultaria em 403. A API recusa por conta
 * própria. Conferido nos controllers, porque a intuição erra aqui:
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
export function menuSectionsFor(user: ApiUser | null): MenuSection[] {
  const isTechnician = user?.role === 'technician'
  const isSuperuser = user?.isSuperuser ?? false

  const sections: MenuSection[] = [
    {
      title: null,
      items: [
        { href: '/analytics', label: 'Painel de Indicadores', icon: 'gauge' },
        { href: '/', label: 'Chamados', icon: 'ticket' },
        { href: '/reports', label: 'Relatórios', icon: 'file-lines' },
      ],
    },
    {
      title: 'Administração',
      items: [
        // A visão geral descreve o que cada área faz — quem administra de vez
        // em quando chega por aqui. Sem este item ela ficaria órfã: a rota
        // existe e nenhum caminho leva até ela.
        {
          href: '/admin',
          label: 'Administração',
          icon: 'screwdriver-wrench',
          visible: isTechnician || isSuperuser,
        },
        {
          href: '/admin/parameters',
          label: 'Parâmetros da empresa',
          icon: 'building',
          visible: isSuperuser,
        },
        {
          href: '/admin/modules',
          label: 'Módulos do sistema',
          icon: 'puzzle-piece',
          visible: isSuperuser,
        },
        {
          href: '/admin/payments',
          label: 'Pagamentos',
          icon: 'credit-card',
          visible: isSuperuser,
        },
        {
          href: '/admin/users',
          label: 'Usuários',
          icon: 'users',
          visible: isTechnician || isSuperuser,
        },
      ],
    },
    {
      title: 'Conta',
      items: [{ href: '/change-password', label: 'Trocar senha', icon: 'key' }],
    },
  ]

  // Uma seção que perdeu todos os itens levaria junto o cabeçalho — "Administração"
  // sozinho, sem nada embaixo, para quem não administra nada.
  return sections
    .map((section) => ({ ...section, items: section.items.filter((i) => i.visible !== false) }))
    .filter((section) => section.items.length > 0)
}

export type MenuItem = NavItem

/** Lista corrida dos destinos visíveis, na ordem em que aparecem na coluna. */
export function menuItemsFor(user: ApiUser | null): MenuItem[] {
  return menuSectionsFor(user).flatMap((section) => section.items)
}
