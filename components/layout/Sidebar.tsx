import Link from 'next/link'

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
  return (
    <nav className="w-60 shrink-0 border-r border-slate-200 bg-white p-4">
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
