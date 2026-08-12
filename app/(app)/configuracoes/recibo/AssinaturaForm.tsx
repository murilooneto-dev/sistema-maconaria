'use client'

import { useActionState } from 'react'
import { atualizarAssinatura, atualizarAssinaturaTesoureiro } from './actions'

export function AssinaturaForm({
  titulo,
  cargo,
  assinaturaUrl,
  tesoureiro,
}: {
  titulo: string
  cargo: string
  assinaturaUrl: string | null
  tesoureiro: boolean
}) {
  const [state, formAction, pending] = useActionState(
    tesoureiro ? atualizarAssinaturaTesoureiro : atualizarAssinatura,
    undefined
  )

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-700">{titulo}</p>
        <p className="text-sm text-slate-500">Cargo (fixo): {cargo}</p>
      </div>

      {assinaturaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assinaturaUrl} alt={`Assinatura atual — ${cargo}`} className="h-16 max-w-full object-contain" />
      )}

      <div className="space-y-1">
        <label htmlFor={`assinatura-${cargo}`} className="text-sm font-medium text-slate-700">
          Imagem da assinatura
        </label>
        <input
          id={`assinatura-${cargo}`}
          name="assinatura"
          type="file"
          accept="image/*"
          required
          className="w-full text-sm"
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
        {pending ? 'Enviando...' : 'Salvar assinatura'}
      </button>
    </form>
  )
}
