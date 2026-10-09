import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getPublicEnv } from '@/lib/env'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const env = getPublicEnv()

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginRoute = request.nextUrl.pathname.startsWith('/login')
  // Recuperação de senha: pedir o link e voltar por ele acontece sem sessão.
  // `/nova-senha` NÃO é pública — só abre com a sessão criada pelo link.
  const isRecuperacaoRoute =
    request.nextUrl.pathname.startsWith('/recuperar-senha') || request.nextUrl.pathname.startsWith('/auth/confirm')

  // Rotinas agendadas não têm sessão: cada rota em /api/cron valida o
  // próprio segredo (CRON_SECRET) e recusa quem não o apresenta.
  const isCronRoute = request.nextUrl.pathname.startsWith('/api/cron/')

  if (!user && !isLoginRoute && !isRecuperacaoRoute && !isCronRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirectResponse = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }

  if (user && isLoginRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    const redirectResponse = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }

  return response
}
