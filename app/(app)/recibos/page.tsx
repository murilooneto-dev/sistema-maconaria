import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { formatarDataBR } from '@/lib/format'

const TIPO_LABEL: Record<string, string> = {
  MENSALIDADE: 'Mensalidade',
  CAMPANHA: 'Campanha',
}

export default async function RecibosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; dataInicio?: string; dataFim?: string; pessoa?: string }>
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
  const podeGerar = profile?.role === 'ADMINISTRADOR' || profile?.role === 'TESOUREIRO'

  let query = supabase
    .from('recibos')
    .select('id, tipo, pessoa, valor, referencia, data, descricao')
    .order('created_at', { ascending: false })

  if (params.tipo) query = query.eq('tipo', params.tipo)
  if (params.dataInicio) query = query.gte('data', params.dataInicio)
  if (params.dataFim) query = query.lte('data', params.dataFim)
  if (params.pessoa) query = query.ilike('pessoa', `%${params.pessoa}%`)

  const { data: recibos, error } = await query

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar recibos: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Recibos</h1>
        {podeGerar && (
          <Link href="/recibos/novo" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Gerar recibo
          </Link>
        )}
      </div>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Tipo</label>
          <select name="tipo" defaultValue={params.tipo ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todos</option>
            <option value="MENSALIDADE">Mensalidade</option>
            <option value="CAMPANHA">Campanha</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">De</label>
          <input type="date" name="dataInicio" defaultValue={params.dataInicio} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Até</label>
          <input type="date" name="dataFim" defaultValue={params.dataFim} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Pessoa</label>
          <input type="text" name="pessoa" defaultValue={params.pessoa} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-end">
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Filtrar
          </button>
        </div>
      </form>

      {(recibos ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum recibo encontrado.</p>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium">Pessoa</th>
                <th className="px-4 py-2 font-medium">Referência</th>
                <th className="px-4 py-2 font-medium">Valor</th>
                <th className="px-4 py-2 font-medium">PDF</th>
              </tr>
            </thead>
            <tbody>
              {(recibos ?? []).map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">{formatarDataBR(r.data)}</td>
                  <td className="px-4 py-2">{TIPO_LABEL[r.tipo]}</td>
                  <td className="px-4 py-2">{r.pessoa}</td>
                  <td className="px-4 py-2">{r.referencia}</td>
                  <td className="px-4 py-2">R$ {Number(r.valor).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <a
                      href={`/recibos/${r.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-700 underline"
                    >
                      Baixar
                    </a>
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
