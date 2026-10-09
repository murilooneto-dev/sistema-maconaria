import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Destino do link de recuperação de senha. Troca o token do e-mail por uma
 * sessão e manda o usuário para a tela de nova senha.
 *
 * Aceita os dois formatos que o Supabase pode gerar:
 * - `token_hash` + `type=recovery`: quando o modelo de e-mail aponta direto
 *   para esta rota. Funciona em qualquer navegador/aparelho.
 * - `code`: fluxo padrão (PKCE). Só funciona no mesmo navegador em que o
 *   link foi solicitado.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const tipo = searchParams.get('type')
  const code = searchParams.get('code')

  const supabase = await createSupabaseServerClient()
  let confirmado = false

  if (tokenHash && tipo === 'recovery') {
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
    confirmado = !error
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    confirmado = !error
  }

  const destino = request.nextUrl.clone()
  destino.search = ''

  if (confirmado) {
    // Destino fixo de propósito: aceitar `next` da URL permitiria usar um
    // link de recuperação legítimo para redirecionar a outra página.
    destino.pathname = '/nova-senha'
  } else {
    destino.pathname = '/recuperar-senha'
    destino.searchParams.set('erro', 'link')
  }

  return NextResponse.redirect(destino)
}
