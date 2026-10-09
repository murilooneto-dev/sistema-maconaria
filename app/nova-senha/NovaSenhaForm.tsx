'use client'

import { useActionState } from 'react'
import { definirNovaSenha } from './actions'

export function NovaSenhaForm() {
  const [state, formAction, pending] = useActionState(definirNovaSenha, undefined)

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Nova senha</h1>
          <p className="text-sm text-slate-500">Defina uma nova senha com pelo menos 8 caracteres.</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="senha" className="text-sm font-medium text-slate-700">
            Nova senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="confirmacao" className="text-sm font-medium text-slate-700">
            Confirmar nova senha
          </label>
          <input
            id="confirmacao"
            name="confirmacao"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
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
          {pending ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </div>
  )
}
