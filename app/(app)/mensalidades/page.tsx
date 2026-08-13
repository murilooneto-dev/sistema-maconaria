import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { GerarMensalidadesButton } from './GerarMensalidadesButton'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function corStatus(status: string | undefined): string {
  switch (status) {
    case 'QUITADA':
      return 'bg-green-100 text-green-800'
    case 'PARCIAL':
      return 'bg-amber-100 text-amber-800'
    case 'PENDENTE':
      return 'bg-red-100 text-red-800'
    case 'CANCELADA':
      return 'bg-slate-100 text-slate-400'
    default:
      return 'bg-slate-50 text-slate-300'
  }
}

export default async function MensalidadesPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; nome?: string }>
}) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const podeGerenciar = profile?.role === 'ADMINISTRADOR' || profile?.role === 'TESOUREIRO'

  const anoSelecionado = params.ano ? Number(params.ano) : new Date().getFullYear()

  let queryMembros = supabase.from('membros').select('id, nome').eq('do_quadro', true).order('nome')

  if (params.nome) {
    queryMembros = queryMembros.ilike('nome', `%${params.nome}%`)
  }

  const { data: membros } = await queryMembros

  const { data: mensalidades, error } = await supabase
    .from('mensalidades')
    .select('membro_id, mes, status')
    .eq('ano', anoSelecionado)

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar mensalidades: {error.message}
      </div>
    )
  }

  const statusPorMembroMes = new Map<string, string>()
  for (const m of mensalidades ?? []) {
    statusPorMembroMes.set(`${m.membro_id}-${m.mes}`, m.status)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Mensalidades — {anoSelecionado}</h1>
        <div className="flex items-center gap-3">
          {podeGerenciar && (
            <Link
              href="/mensalidades/pagamento"
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Registrar pagamento
            </Link>
          )}
          {podeGerenciar && <GerarMensalidadesButton />}
        </div>
      </div>

      <form className="flex flex-wrap gap-3">
        <input
          name="nome"
          type="text"
          placeholder="Buscar por nome"
          defaultValue={params.nome ?? ''}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          name="ano"
          defaultValue={String(anoSelecionado)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {[anoSelecionado - 1, anoSelecionado, anoSelecionado + 1].map((ano) => (
            <option key={ano} value={ano}>
              {ano}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700">
          Filtrar
        </button>
      </form>

      {!membros || membros.length === 0 ? (
        <p className="text-sm text-slate-500">
          {params.nome ? 'Nenhum membro encontrado para essa busca.' : 'Nenhum membro do quadro cadastrado.'}
        </p>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Membro</th>
                {MESES.map((mes) => (
                  <th key={mes} className="px-2 py-2 text-center font-medium">
                    {mes}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {membros.map((membro) => (
                <tr key={membro.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-medium text-slate-900">{membro.nome}</td>
                  {MESES.map((_, index) => {
                    const status = statusPorMembroMes.get(`${membro.id}-${index + 1}`)
                    return (
                      <td key={index} className="px-2 py-2 text-center">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs ${corStatus(status)}`}>
                          {status ? status.slice(0, 3) : '—'}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
