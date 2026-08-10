'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/membros', label: 'Membros' },
  { href: '/mensalidades', label: 'Mensalidades' },
  { href: '/campanhas', label: 'Campanhas' },
  { href: '/financeiro', label: 'Financeiro' },
  { href: '/grande-loja', label: 'Grande Loja' },
  { href: '/recibos', label: 'Recibos' },
  { href: '/relatorios', label: 'Relatórios' },
  { href: '/configuracoes', label: 'Configurações' },
] as const

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={
                  isActive
                    ? 'block rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white'
                    : 'block rounded px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
                }
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
