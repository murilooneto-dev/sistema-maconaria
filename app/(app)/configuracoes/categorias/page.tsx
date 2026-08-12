import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { NovaCategoriaForm } from './NovaCategoriaForm'
import { CategoriasTable } from './CategoriasTable'

export default async function CategoriasConfigPage() {
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

  const { data: categorias, error } = await supabase
    .from('categorias_movimentacao')
    .select('id, nome, tipo, sistema, ativo')
    .order('tipo')
    .order('nome')

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar categorias: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Configurações — Categorias de movimentação</h1>
      <NovaCategoriaForm />
      {categorias.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma categoria cadastrada.</p>
      ) : (
        <CategoriasTable categorias={categorias} />
      )}
    </div>
  )
}
