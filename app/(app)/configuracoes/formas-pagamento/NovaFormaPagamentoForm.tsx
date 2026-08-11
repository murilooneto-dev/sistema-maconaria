'use client'

import { useActionState } from 'react'
import { criarFormaPagamento } from './actions'

export function NovaFormaPagamentoForm() {
  const [state, formAction, pending] = useActionState(criarFormaPagamento, undefined)

  return (
    <form action={formAction} className="max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">Nova forma de pagamento</h2>

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
