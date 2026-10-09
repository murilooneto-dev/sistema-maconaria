import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { NovoUsuarioForm } from './NovoUsuarioForm'
import { UsuariosTable } from './UsuariosTable'

export default async function UsuariosPage() {
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

  const { data: usuarios, error } = await supabase
    .from('profiles')
    .select('id, username, nome, role, ativo, email, created_at')
    .order('nome')

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar usuários: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Usuários</h1>

      <NovoUsuarioForm />

      {usuarios.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum usuário cadastrado.</p>
      ) : (
        <UsuariosTable usuarios={usuarios} currentUserId={user.id} />
      )}
    </div>
  )
}
