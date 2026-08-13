'use client'

import { useActionState } from 'react'
import { signIn } from './actions'

export function LoginForm({ lojaNome, lojaLogoUrl }: { lojaNome: string; lojaLogoUrl: string | null }) {
  const [state, formAction, pending] = useActionState(signIn, undefined)

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
        <div className="flex flex-col items-center gap-2 text-center">
          {lojaLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lojaLogoUrl} alt={`Logo — ${lojaNome}`} className="h-16 w-16 object-contain" />
          )}
          <h1 className="text-xl font-semibold text-slate-900">{lojaNome}</h1>
        </div>

        <div className="space-y-1">
          <label htmlFor="username" className="text-sm font-medium text-slate-700">
            Usuário
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-slate-700">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
