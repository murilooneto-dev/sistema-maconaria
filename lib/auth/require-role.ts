import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { canAccess, type PerfilAutorizacao, type Role } from '@/lib/domain/authorization'

export class AuthorizationError extends Error {}

type PerfilAtual = { id: string; role: Role; ativo: boolean }

async function perfilAtual(): Promise<PerfilAtual | null> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, ativo')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return null
  }

  return { id: profile.id, role: profile.role as Role, ativo: profile.ativo }
}

function paraDecisao(perfil: PerfilAtual | null): PerfilAutorizacao {
  if (!perfil) {
    return null
  }
  return { role: perfil.role, ativo: perfil.ativo }
}

/** Lança AuthorizationError se o usuário atual não for ADMINISTRADOR ativo. */
export async function requireAdmin(): Promise<PerfilAtual> {
  const perfil = await perfilAtual()

  if (!canAccess(paraDecisao(perfil), 'ADMINISTRADOR')) {
    throw new AuthorizationError('Apenas o Administrador pode executar esta ação.')
  }

  return perfil as PerfilAtual
}

/** Lança AuthorizationError se o usuário atual não for ADMINISTRADOR ou TESOUREIRO ativo. */
export async function requireTesoureiro(): Promise<PerfilAtual> {
  const perfil = await perfilAtual()

  if (!canAccess(paraDecisao(perfil), 'TESOUREIRO')) {
    throw new AuthorizationError('Apenas Administrador ou Tesoureiro podem executar esta ação.')
  }

  return perfil as PerfilAtual
}
