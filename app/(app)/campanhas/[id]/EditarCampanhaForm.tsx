'use client'

import { useState, useTransition } from 'react'
import { atualizarCampanha } from '../actions'

type Campanha = {
  id: string
  titulo: string
  objetivo: string | null
  meta: number
  pessoa_ajudada: string | null
  contato: string | null
  endereco: string | null
  descricao: string | null
  data_inicial: string
  data_final: string | null
}

export function EditarCampanhaForm({ campanha }: { campanha: Campanha }) {
  const [aberto, setAberto] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
      >
        Editar
      </button>
    )
  }

  return (
    <form
      className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      onSubmit={(e) => {
        e.preventDefault()
        const form = e.currentTarget
        const dados = {
          titulo: (form.elements.namedItem('titulo') as HTMLInputElement).value.trim(),
          objetivo: (form.elements.namedItem('objetivo') as HTMLInputElement).value.trim() || null,
          meta: Number((form.elements.namedItem('meta') as HTMLInputElement).value),
          pessoaAjudada: (form.elements.namedItem('pessoaAjudada') as HTMLInputElement).value.trim() || null,
          contato: (form.elements.namedItem('contato') as HTMLInputElement).value.trim() || null,
          endereco: (form.elements.namedItem('endereco') as HTMLInputElement).value.trim() || null,
          descricao: (form.elements.namedItem('descricao') as HTMLTextAreaElement).value.trim() || null,
          dataInicial: (form.elements.namedItem('dataInicial') as HTMLInputElement).value,
          dataFinal: (form.elements.namedItem('dataFinal') as HTMLInputElement).value || null,
        }
        startTransition(async () => {
          const result = await atualizarCampanha(campanha.id, dados)
          if (result.error) {
            setErro(result.error)
          } else {
            setErro(null)
            setAberto(false)
          }
        })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="titulo" className="text-sm font-medium text-slate-700">
            Título
          </label>
          <input
            id="titulo"
            name="titulo"
            type="text"
            defaultValue={campanha.titulo}
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
            defaultValue={campanha.objetivo ?? ''}
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
            defaultValue={campanha.meta}
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
            defaultValue={campanha.pessoa_ajudada ?? ''}
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
            defaultValue={campanha.contato ?? ''}
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
            defaultValue={campanha.endereco ?? ''}
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
            defaultValue={campanha.data_inicial}
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
            defaultValue={campanha.data_final ?? ''}
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
            defaultValue={campanha.descricao ?? ''}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {erro && (
        <p className="text-sm text-red-600" role="alert">
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
