import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const SECOES = [
  { titulo: 'Usuários', href: '/configuracoes/usuarios', apenasAdmin: true },
  { titulo: 'Loja', href: '/configuracoes/loja', apenasAdmin: true },
  { titulo: 'Mensalidades', href: '/configuracoes/mensalidades', apenasAdmin: true },
  { titulo: 'Remidos', href: '/configuracoes/remidos', apenasAdmin: true },
  { titulo: 'Contas', href: '/configuracoes/contas', apenasAdmin: true },
  { titulo: 'Formas de pagamento', href: '/configuracoes/formas-pagamento', apenasAdmin: true },
  { titulo: 'Categorias de movimentação', href: '/configuracoes/categorias', apenasAdmin: true },
  { titulo: 'Recibo', href: '/configuracoes/recibo', apenasAdmin: true },
] as const

export default async function ConfiguracoesPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    isAdmin = profile?.role === 'ADMINISTRADOR'
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Configurações</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECOES.map((secao) => {
          const habilitado = secao.href !== null && (!secao.apenasAdmin || isAdmin)

          if (habilitado && secao.href) {
            return (
              <Link
                key={secao.titulo}
                href={secao.href}
                className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-medium text-slate-900 hover:border-slate-400"
              >
                {secao.titulo}
              </Link>
            )
          }

          return (
            <div
              key={secao.titulo}
              className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-400"
            >
              {secao.titulo}
              <span className="ml-2 text-xs">(em breve)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
