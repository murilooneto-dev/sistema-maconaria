'use client'

import { useTransition } from 'react'
import { concluirCampanha, cancelarCampanha, reabrirCampanha } from '../actions'

export function StatusCampanhaActions({ campanhaId, status }: { campanhaId: string; status: string }) {
  const [isPending, startTransition] = useTransition()

  function handle(action: (id: string) => Promise<{ error?: string }>, confirmMessage: string) {
    if (!window.confirm(confirmMessage)) return
    startTransition(async () => {
      const result = await action(campanhaId)
      if (result.error) {
        window.alert(result.error)
      }
    })
  }

  return (
    <div className="flex gap-2">
      {status === 'EM_ANDAMENTO' && (
        <>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handle(concluirCampanha, 'Marcar esta campanha como concluída?')}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
          >
            Concluir
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handle(cancelarCampanha, 'Cancelar esta campanha?')}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
          >
            Cancelar
          </button>
        </>
      )}
      {(status === 'CONCLUIDA' || status === 'CANCELADA') && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => handle(reabrirCampanha, 'Reabrir esta campanha?')}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
        >
          Reabrir
        </button>
      )}
    </div>
  )
}
