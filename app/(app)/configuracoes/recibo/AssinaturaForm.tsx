'use client'

import { useActionState } from 'react'
import { atualizarAssinatura } from './actions'

export function AssinaturaForm({ assinaturaUrl }: { assinaturaUrl: string | null }) {
  const [state, formAction, pending] = useActionState(atualizarAssinatura, undefined)

  return (
    <form
      action={formAction}
      className="max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-700">Cargo (fixo)</p>
        <p className="text-sm text-slate-500">Venerável Mestre</p>
      </div>

      {assinaturaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assinaturaUrl} alt="Assinatura atual" className="h-16 max-w-full object-contain" />
      )}

      <div className="space-y-1">
        <label htmlFor="assinatura" className="text-sm font-medium text-slate-700">
          Imagem da assinatura
        </label>
        <input
          id="assinatura"
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
