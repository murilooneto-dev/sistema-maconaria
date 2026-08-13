import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'

type SearchParams = {
  nome?: string
  situacao?: string
  do_quadro?: string
  remido?: string
  recolhe?: string
  em_iniciacao?: string
}

export default async function MembrosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
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
  const isAdmin = profile?.role === 'ADMINISTRADOR'

  let query = supabase
    .from('membros')
    .select('id, nome, telefone, matricula, do_quadro, remido, recolhe, em_iniciacao, situacao')
    .order('nome')

  if (params.nome) {
    query = query.ilike('nome', `%${params.nome}%`)
  }
  if (params.situacao) {
    query = query.eq('situacao', params.situacao)
  }
  if (params.do_quadro) {
    query = query.eq('do_quadro', params.do_quadro === 'true')
  }
  if (params.remido) {
    query = query.eq('remido', params.remido === 'true')
  }
  if (params.recolhe) {
    query = query.eq('recolhe', params.recolhe === 'true')
  }
  if (params.em_iniciacao) {
    query = query.eq('em_iniciacao', params.em_iniciacao === 'true')
  }

  const { data: membros, error } = await query

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar membros: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Membros</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <Link
              href="/membros/importar"
              className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Importar CSV
            </Link>
            <Link
              href="/membros/novo"
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Novo Membro
            </Link>
          </div>
        )}
      </div>

      <form className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <input
          name="nome"
          type="text"
          placeholder="Buscar por nome"
          defaultValue={params.nome ?? ''}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          name="situacao"
          defaultValue={params.situacao ?? ''}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Situação (todas)</option>
          <option value="ATIVO">Ativo</option>
          <option value="INATIVO">Inativo</option>
          <option value="IRREGULAR">Irregular</option>
        </select>
        <select
          name="do_quadro"
          defaultValue={params.do_quadro ?? ''}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Do quadro (todos)</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
        <select
          name="remido"
          defaultValue={params.remido ?? ''}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Remido (todos)</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
        <select
          name="recolhe"
          defaultValue={params.recolhe ?? ''}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Recolhe (todos)</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
        <select
          name="em_iniciacao"
          defaultValue={params.em_iniciacao ?? ''}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Em iniciação (todos)</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
        <button
          type="submit"
          className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Filtrar
        </button>
      </form>

      {membros.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum membro encontrado.</p>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">Telefone</th>
                <th className="px-4 py-2 font-medium">Matrícula</th>
                <th className="px-4 py-2 font-medium">Do quadro</th>
                <th className="px-4 py-2 font-medium">Remido</th>
                <th className="px-4 py-2 font-medium">Recolhe</th>
                <th className="px-4 py-2 font-medium">Em iniciação</th>
                <th className="px-4 py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {membros.map((membro) => (
                <tr key={membro.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/membros/${membro.id}`} className="font-medium text-slate-900 underline">
                      {membro.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{membro.telefone ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{membro.matricula ?? '—'}</td>
                  <td className="px-4 py-2">{membro.do_quadro ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-2">{membro.remido ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-2">{membro.recolhe ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-2">{membro.em_iniciacao ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        membro.situacao === 'ATIVO'
                          ? 'text-green-700'
                          : membro.situacao === 'IRREGULAR'
                            ? 'text-red-700'
                            : 'text-slate-400'
                      }
                    >
                      {membro.situacao}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
