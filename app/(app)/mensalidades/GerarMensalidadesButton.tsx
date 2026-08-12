'use client'

import { useActionState } from 'react'
import { gerarMensalidades } from './actions'

export function GerarMensalidadesButton() {
  const [state, formAction, pending] = useActionState(gerarMensalidades, undefined)

  return (
    <form action={formAction} className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
      >
        {pending ? 'Gerando...' : 'Gerar mensalidades'}
      </button>
      {state && 'error' in state && (
        <span className="text-sm text-red-600" role="alert">
          {state.error}
        </span>
      )}
      {state && 'success' in state && (
        <span className="text-sm text-green-700" role="status">
          {state.success}
        </span>
      )}
    </form>
  )
}
