'use client'

import { useActionState } from 'react'
import { criarCentroDeCusto } from './actions'

export function NovoCentroForm() {
  const [state, formAction, pending] = useActionState(criarCentroDeCusto, undefined)

  return (
    <form action={formAction} className="max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">Novo centro de custo</h2>

      <div className="space-y-1">
        <label htmlFor="nome" className="text-sm font-medium text-slate-700">
          Nome
        </label>
        <input
          id="nome"
          name="nome"
          type="text"
          required
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="cor" className="text-sm font-medium text-slate-700">
          Cor
        </label>
        <input id="cor" name="cor" type="color" defaultValue="#64748b" className="h-9 w-16 rounded border border-slate-300" />
      </div>

      {state && 'error' in state && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state && 'success' in state && (
        <p className="text-sm text-green-700" role="status">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Criando...' : 'Criar'}
      </button>
    </form>
  )
}
