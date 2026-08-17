import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { calcularArrecadado, calcularPercentual } from '@/lib/domain/campanhas'

const STATUS_LABEL: Record<string, string> = {
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
}

const STATUS_COLOR: Record<string, string> = {
  EM_ANDAMENTO: 'text-blue-700',
  CONCLUIDA: 'text-green-700',
  CANCELADA: 'text-slate-400',
}

export default async function CampanhasPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const podeCriar = profile?.role === 'ADMINISTRADOR' || profile?.role === 'TESOUREIRO'

  const { data: campanhas, error } = await supabase
    .from('campanhas')
    .select('id, titulo, objetivo, meta, status, data_inicial, data_final, doacoes(valor, status)')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar campanhas: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Campanhas</h1>
        {podeCriar && (
          <Link href="/campanhas/nova" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Nova campanha
          </Link>
        )}
      </div>

      {(campanhas ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma campanha cadastrada.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(campanhas ?? []).map((c) => {
            const doacoesAtivas = (c.doacoes ?? []).filter((d: { status: string }) => d.status === 'ATIVO')
            const arrecadado = calcularArrecadado(doacoesAtivas)
            const meta = Number(c.meta)
            const percentual = calcularPercentual(arrecadado, meta)
            const saldo = Math.max(0, meta - arrecadado)

            return (
              <Link
                key={c.id}
                href={`/campanhas/${c.id}`}
                className="block space-y-3 rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400"
              >
                <div className="flex items-start justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">{c.titulo}</h2>
                  <span className={`text-xs font-medium ${STATUS_COLOR[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>
                {c.objetivo && <p className="text-xs text-slate-500">{c.objetivo}</p>}
                <div className="space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{ width: `${percentual}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">{percentual.toFixed(0)}% da meta</p>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-400">Meta</dt>
                    <dd className="font-medium text-slate-900">R$ {meta.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Arrecadado</dt>
                    <dd className="font-medium text-green-700">R$ {arrecadado.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Saldo</dt>
                    <dd className="font-medium text-slate-900">R$ {saldo.toFixed(2)}</dd>
                  </div>
                </dl>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
