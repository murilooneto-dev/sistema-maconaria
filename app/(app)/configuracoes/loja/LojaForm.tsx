'use client'

import { useActionState } from 'react'
import { atualizarLoja } from './actions'

export function LojaForm({ nome, logoUrl }: { nome: string; logoUrl: string | null }) {
  const [state, formAction, pending] = useActionState(atualizarLoja, undefined)

  return (
    <form
      action={formAction}
      className="max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6"
    >
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="Logo atual da Loja" className="h-16 w-16 rounded object-contain" />
      )}

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
  )
}
