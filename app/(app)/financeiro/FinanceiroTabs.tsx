'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/financeiro', label: 'Movimentações' },
  { href: '/financeiro/nova', label: 'Nova movimentação' },
  { href: '/financeiro/transferencias', label: 'Transferências' },
  { href: '/financeiro/fechamento', label: 'Fechamento mensal' },
] as const

export function FinanceiroTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-slate-200 text-sm">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              isActive
                ? 'shrink-0 whitespace-nowrap border-b-2 border-slate-900 px-3 py-2 font-medium text-slate-900'
                : 'shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-slate-500 hover:text-slate-900'
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
