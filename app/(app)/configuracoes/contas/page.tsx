import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { NovaContaForm } from './NovaContaForm'
import { ContasTable } from './ContasTable'

export default async function ContasConfigPage() {
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

  const { data: contas, error } = await supabase
    .from('contas')
    .select('id, nome, descricao, saldo_inicial, data_saldo_inicial, ativo')
    .order('nome')

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar contas: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Configurações — Contas</h1>
      <NovaContaForm />
      {contas.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma conta cadastrada.</p>
      ) : (
        <ContasTable contas={contas} />
      )}
    </div>
  )
}
