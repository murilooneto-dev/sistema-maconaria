'use client'

import { useActionState } from 'react'
import { fecharPeriodo } from './actions'

export function FecharPeriodoButton({ ano, mes }: { ano: number; mes: number }) {
  const [state, formAction, pending] = useActionState(fecharPeriodo, undefined)

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="ano" value={ano} />
      <input type="hidden" name="mes" value={mes} />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Fechando...' : `Fechar período ${String(mes).padStart(2, '0')}/${ano}`}
      </button>
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
    </form>
  )
}
