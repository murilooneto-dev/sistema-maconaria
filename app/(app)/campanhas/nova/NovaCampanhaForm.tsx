'use client'

import { useActionState } from 'react'
import { criarCampanha } from '../actions'

export function NovaCampanhaForm() {
  const [state, formAction, pending] = useActionState(criarCampanha, undefined)

  return (
    <form action={formAction} className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="titulo" className="text-sm font-medium text-slate-700">
            Título
          </label>
          <input
            id="titulo"
            name="titulo"
            type="text"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="objetivo" className="text-sm font-medium text-slate-700">
            Objetivo
          </label>
          <input
            id="objetivo"
            name="objetivo"
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="meta" className="text-sm font-medium text-slate-700">
            Meta
          </label>
          <input
            id="meta"
            name="meta"
            type="number"
            step="0.01"
            min="0"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="pessoaAjudada" className="text-sm font-medium text-slate-700">
            Pessoa ajudada
          </label>
          <input
            id="pessoaAjudada"
            name="pessoaAjudada"
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="contato" className="text-sm font-medium text-slate-700">
            Contato
          </label>
          <input
            id="contato"
            name="contato"
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="endereco" className="text-sm font-medium text-slate-700">
            Endereço
          </label>
          <input
            id="endereco"
            name="endereco"
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="dataInicial" className="text-sm font-medium text-slate-700">
            Data inicial
          </label>
          <input
            id="dataInicial"
            name="dataInicial"
            type="date"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="dataFinal" className="text-sm font-medium text-slate-700">
            Data final (opcional)
          </label>
          <input
            id="dataFinal"
            name="dataFinal"
            type="date"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="descricao" className="text-sm font-medium text-slate-700">
            Descrição
          </label>
          <textarea
            id="descricao"
            name="descricao"
            rows={3}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
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
        {pending ? 'Criando...' : 'Criar campanha'}
      </button>
    </form>
  )
}
