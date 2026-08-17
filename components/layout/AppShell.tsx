'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/login/actions'

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

type AppShellProps = {
  nome: string
  role: string
  lojaNome: string
  lojaLogoUrl: string | null
  children: React.ReactNode
}

export function AppShell({ nome, role, lojaNome, lojaLogoUrl, children }: AppShellProps) {
  const pathname = usePathname()
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {menuAberto && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMenuAberto(false)}
          aria-hidden="true"
        />
      )}

      <nav
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4 transition-transform duration-200 ease-in-out md:static md:z-auto md:w-60 md:translate-x-0 ${
          menuAberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMenuAberto(false)}
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMenuAberto(true)}
              aria-label="Abrir menu"
              className="shrink-0 rounded p-2 text-slate-700 hover:bg-slate-100 md:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M2.5 5H17.5M2.5 10H17.5M2.5 15H17.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            {lojaLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lojaLogoUrl}
                alt={`Logo — ${lojaNome}`}
                className="h-8 w-8 shrink-0 rounded object-contain sm:h-10 sm:w-10"
              />
            )}
            <span className="truncate font-semibold text-slate-900">{lojaNome}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="hidden text-right text-sm sm:block">
              <p className="font-medium text-slate-900">{nome}</p>
              <p className="text-slate-500">{role}</p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100 sm:px-3"
              >
                Sair
              </button>
            </form>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden bg-slate-50 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
