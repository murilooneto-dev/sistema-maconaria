import Link from 'next/link'

const RELATORIOS = [
  { titulo: 'Resumo de membros', href: '/relatorios/membros' },
  { titulo: 'Resumo geral de campanhas', href: '/relatorios/campanhas' },
  { titulo: 'Resumo de campanha específica', href: '/relatorios/campanhas?modo=especifica' },
  { titulo: 'Movimentação de entradas e saídas', href: '/relatorios/financeiro' },
  { titulo: 'Relatório Grande Loja', href: '/relatorios/grande-loja' },
  { titulo: 'Saldos por conta', href: '/relatorios/saldos' },
  { titulo: 'Mensalidades / Inadimplência', href: '/relatorios/mensalidades' },
] as const

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Relatórios</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RELATORIOS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-medium text-slate-900 hover:border-slate-400"
          >
            {r.titulo}
          </Link>
        ))}
      </div>
    </div>
  )
}
