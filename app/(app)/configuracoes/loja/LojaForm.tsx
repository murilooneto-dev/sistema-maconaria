'use client'

import { useActionState } from 'react'
import { atualizarLoja, removerLogo } from './actions'

export function LojaForm({ nome, logoUrl }: { nome: string; logoUrl: string | null }) {
  const [state, formAction, pending] = useActionState(atualizarLoja, undefined)
  const [remoState, remoAction, remoPending] = useActionState(removerLogo, undefined)

  return (
    <div className="max-w-md space-y-4">
      {logoUrl && (
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="Logo atual da Loja" className="h-16 w-16 rounded object-contain" />
          <form action={remoAction}>
            <button
              type="submit"
              disabled={remoPending}
              className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {remoPending ? 'Removendo...' : 'Remover logo'}
            </button>
          </form>
        </div>
      )}
      {remoState && 'error' in remoState && (
        <p className="text-sm text-red-600" role="alert">
          {remoState.error}
        </p>
      )}
      {remoState && 'success' in remoState && (
        <p className="text-sm text-green-700" role="status">
          {remoState.success}
        </p>
      )}

      <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div className="space-y-1">
          <label htmlFor="nome" className="text-sm font-medium text-slate-700">
            Nome da Loja
          </label>
          <input
            id="nome"
            name="nome"
            type="text"
            defaultValue={nome}
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="logo" className="text-sm font-medium text-slate-700">
            Logo (opcional)
          </label>
          <input id="logo" name="logo" type="file" accept="image/*" className="w-full text-sm" />
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
          {pending ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </div>
  )
}
