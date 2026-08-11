'use client'

import { useActionState } from 'react'
import { criarConta } from './actions'

export function NovaContaForm() {
  const [state, formAction, pending] = useActionState(criarConta, undefined)

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">Nova conta</h2>

      <div className="grid gap-4 sm:grid-cols-2">
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
          <label htmlFor="descricao" className="text-sm font-medium text-slate-700">
            Descrição (opcional)
          </label>
          <input
            id="descricao"
            name="descricao"
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="saldoInicial" className="text-sm font-medium text-slate-700">
            Saldo inicial (R$)
          </label>
          <input
            id="saldoInicial"
            name="saldoInicial"
            type="number"
            step="0.01"
            defaultValue="0"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="dataSaldoInicial" className="text-sm font-medium text-slate-700">
            Data do saldo inicial
          </label>
          <input
            id="dataSaldoInicial"
            name="dataSaldoInicial"
            type="date"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
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
        {pending ? 'Criando...' : 'Criar conta'}
      </button>
    </form>
  )
}
