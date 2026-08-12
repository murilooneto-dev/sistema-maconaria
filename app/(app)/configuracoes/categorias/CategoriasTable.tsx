'use client'

import { useState, useTransition } from 'react'
import { atualizarCategoria } from './actions'

type Categoria = {
  id: string
  nome: string
  tipo: string
  sistema: boolean
  ativo: boolean
}

export function CategoriasTable({ categorias }: { categorias: Categoria[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ id: string; message: string; isError: boolean } | null>(
    null
  )

  function handleToggleAtivo(categoria: Categoria) {
    const confirmMessage = categoria.ativo
      ? `Desativar a categoria ${categoria.nome}?`
      : `Reativar a categoria ${categoria.nome}?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    startTransition(async () => {
      const result = await atualizarCategoria(categoria.id, { nome: categoria.nome, ativo: !categoria.ativo })
      setFeedback({
        id: categoria.id,
        message: result.error ?? 'Status atualizado.',
        isError: Boolean(result.error),
      })
    })
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Nome</th>
            <th className="px-4 py-2 font-medium">Tipo</th>
            <th className="px-4 py-2 font-medium">Situação</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {categorias.map((categoria) => (
            <tr key={categoria.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2">
                {editingId === categoria.id ? (
                  <EditForm
                    categoria={categoria}
                    pending={isPending}
                    onCancel={() => setEditingId(null)}
                    onSave={(nome) => {
                      startTransition(async () => {
                        const result = await atualizarCategoria(categoria.id, {
                          nome,
                          ativo: categoria.ativo,
                        })
                        setFeedback({
                          id: categoria.id,
                          message: result.error ?? 'Categoria atualizada.',
                          isError: Boolean(result.error),
                        })
                        if (!result.error) {
                          setEditingId(null)
                        }
                      })
                    }}
                  />
                ) : (
                  <>
                    {categoria.nome}
                    {categoria.sistema && (
                      <span className="ml-2 text-xs text-slate-400">(sistema)</span>
                    )}
                  </>
                )}
              </td>
              <td className="px-4 py-2">{categoria.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}</td>
              <td className="px-4 py-2">
                <span className={categoria.ativo ? 'text-green-700' : 'text-slate-400'}>
                  {categoria.ativo ? 'Ativa' : 'Inativa'}
                </span>
              </td>
              <td className="space-x-2 px-4 py-2">
                {!categoria.sistema && (
                  <>
                    {editingId !== categoria.id && (
                      <button
                        type="button"
                        onClick={() => setEditingId(categoria.id)}
                        className="text-slate-700 underline"
                      >
                        Editar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleToggleAtivo(categoria)}
                      disabled={isPending}
                      className="text-slate-700 underline disabled:opacity-50"
                    >
                      {categoria.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {feedback && (
        <p
          className={`px-4 py-2 text-sm ${feedback.isError ? 'text-red-600' : 'text-green-700'}`}
          role={feedback.isError ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      )}
    </div>
  )
}

function EditForm({
  categoria,
  pending,
  onSave,
  onCancel,
}: {
  categoria: Categoria
  pending: boolean
  onSave: (nome: string) => void
  onCancel: () => void
}) {
  const [nome, setNome] = useState(categoria.nome)

  return (
    <div className="space-y-2">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <div className="space-x-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => onSave(nome)}
          className="text-sm text-slate-900 underline disabled:opacity-50"
        >
          Salvar
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 underline">
          Cancelar
        </button>
      </div>
    </div>
  )
}
