import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { NovoCentroForm } from './NovoCentroForm'
import { CentrosDeCustoList } from './CentrosDeCustoList'

export default async function CentrosDeCustoConfigPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'ADMINISTRADOR') {
    return <AcessoNegado />
  }

  const [{ data: centros, error: centrosError }, { data: categorias, error: categoriasError }, { data: vinculos }] =
    await Promise.all([
      supabase.from('centros_de_custo').select('id, nome, cor, ativo').order('nome'),
      supabase.from('categorias_movimentacao').select('id, nome, tipo').eq('ativo', true).order('tipo').order('nome'),
      supabase.from('centros_de_custo_categorias').select('centro_de_custo_id, categoria_id'),
    ])

  if (centrosError || categoriasError) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar centros de custo: {(centrosError ?? categoriasError)?.message}
      </div>
    )
  }

  const centrosComCategorias = (centros ?? []).map((centro) => ({
    ...centro,
    categoriaIds: (vinculos ?? [])
      .filter((v) => v.centro_de_custo_id === centro.id)
      .map((v) => v.categoria_id),
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Configurações — Centros de custo</h1>
      <NovoCentroForm />
      {centrosComCategorias.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum centro de custo cadastrado.</p>
      ) : (
        <CentrosDeCustoList centros={centrosComCategorias} categorias={categorias ?? []} />
      )}
    </div>
  )
}
