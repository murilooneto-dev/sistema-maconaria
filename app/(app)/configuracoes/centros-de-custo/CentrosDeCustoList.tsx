'use client'

import { useState, useTransition } from 'react'
import { atualizarCentroDeCusto, atualizarCategoriasDoCentro } from './actions'

type Categoria = { id: string; nome: string; tipo: 'ENTRADA' | 'SAIDA' }
type Centro = { id: string; nome: string; cor: string; ativo: boolean; categoriaIds: string[] }

export function CentrosDeCustoList({ centros, categorias }: { centros: Centro[]; categorias: Categoria[] }) {
  const [expandidoId, setExpandidoId] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {centros.map((centro) => (
        <CentroRow
          key={centro.id}
          centro={centro}
          categorias={categorias}
          expandido={expandidoId === centro.id}
          onToggleExpandir={() => setExpandidoId(expandidoId === centro.id ? null : centro.id)}
        />
      ))}
    </div>
  )
}

function CentroRow({
  centro,
  categorias,
  expandido,
  onToggleExpandir,
}: {
  centro: Centro
  categorias: Categoria[]
  expandido: boolean
  onToggleExpandir: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [nome, setNome] = useState(centro.nome)
  const [cor, setCor] = useState(centro.cor)
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null)
  const [categoriaIds, setCategoriaIds] = useState<Set<string>>(new Set(centro.categoriaIds))

  function handleSalvarDados() {
    startTransition(async () => {
      const result = await atualizarCentroDeCusto(centro.id, { nome, cor, ativo: centro.ativo })
      setFeedback({ message: result.error ?? 'Centro de custo atualizado.', isError: Boolean(result.error) })
    })
  }

  function handleToggleAtivo() {
    const confirmMessage = centro.ativo ? `Desativar o centro ${centro.nome}?` : `Reativar o centro ${centro.nome}?`
    if (!window.confirm(confirmMessage)) return

    startTransition(async () => {
      const result = await atualizarCentroDeCusto(centro.id, { nome, cor, ativo: !centro.ativo })
      setFeedback({ message: result.error ?? 'Status atualizado.', isError: Boolean(result.error) })
    })
  }

  function handleToggleCategoria(categoriaId: string) {
    setCategoriaIds((prev) => {
      const next = new Set(prev)
      if (next.has(categoriaId)) {
        next.delete(categoriaId)
      } else {
        next.add(categoriaId)
      }
      return next
    })
  }

  function handleSalvarCategorias() {
    startTransition(async () => {
      const result = await atualizarCategoriasDoCentro(centro.id, [...categoriaIds])
      setFeedback({ message: result.error ?? 'Categorias do centro atualizadas.', isError: Boolean(result.error) })
    })
  }

  const entradas = categorias.filter((c) => c.tipo === 'ENTRADA')
  const saidas = categorias.filter((c) => c.tipo === 'SAIDA')

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-block h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: centro.cor }} />
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="min-w-[10rem] flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <input
          type="color"
          value={cor}
          onChange={(e) => setCor(e.target.value)}
          className="h-8 w-12 rounded border border-slate-300"
        />
        <span className={centro.ativo ? 'text-sm text-green-700' : 'text-sm text-slate-400'}>
          {centro.ativo ? 'Ativo' : 'Inativo'}
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={handleSalvarDados}
          className="text-sm text-slate-700 underline disabled:opacity-50"
        >
          Salvar
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={handleToggleAtivo}
          className="text-sm text-slate-700 underline disabled:opacity-50"
        >
          {centro.ativo ? 'Desativar' : 'Reativar'}
        </button>
        <button type="button" onClick={onToggleExpandir} className="text-sm text-slate-700 underline">
          {expandido ? 'Ocultar categorias' : 'Categorias'}
        </button>
      </div>

      {feedback && (
        <p className={`mt-2 text-sm ${feedback.isError ? 'text-red-600' : 'text-green-700'}`} role={feedback.isError ? 'alert' : 'status'}>
          {feedback.message}
        </p>
      )}

      {expandido && (
        <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Entradas</h3>
            <ul className="space-y-1">
              {entradas.map((categoria) => (
                <li key={categoria.id}>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={categoriaIds.has(categoria.id)}
                      onChange={() => handleToggleCategoria(categoria.id)}
                    />
                    {categoria.nome}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Saídas</h3>
            <ul className="space-y-1">
              {saidas.map((categoria) => (
                <li key={categoria.id}>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={categoriaIds.has(categoria.id)}
                      onChange={() => handleToggleCategoria(categoria.id)}
                    />
                    {categoria.nome}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleSalvarCategorias}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Salvar categorias
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
