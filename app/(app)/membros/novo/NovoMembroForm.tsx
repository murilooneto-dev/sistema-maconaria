'use client'

import { useActionState } from 'react'
import { criarMembro } from '../actions'

export function NovoMembroForm() {
  const [state, formAction, pending] = useActionState(criarMembro, undefined)

  return (
    <form action={formAction} className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6">
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
        <label htmlFor="matricula" className="text-sm font-medium text-slate-700">
          Matrícula
        </label>
        <input
          id="matricula"
          name="matricula"
          type="text"
          required
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="telefone" className="text-sm font-medium text-slate-700">
          Telefone (opcional)
        </label>
        <input
          id="telefone"
          name="telefone"
          type="text"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="doQuadro" defaultChecked />
          Do quadro
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="remido" />
          Remido
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="recolhe" />
          Recolhe
        </label>
      </div>

      {state && 'error' in state && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Criando...' : 'Criar membro'}
      </button>
    </form>
  )
}
