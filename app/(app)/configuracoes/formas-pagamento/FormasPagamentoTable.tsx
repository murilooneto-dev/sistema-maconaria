'use client'

import { useState, useTransition } from 'react'
import { atualizarFormaPagamento } from './actions'

type FormaPagamento = {
  id: string
  nome: string
  ativo: boolean
}

export function FormasPagamentoTable({ formas }: { formas: FormaPagamento[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ id: string; message: string; isError: boolean } | null>(
    null
  )

  function handleToggleAtivo(forma: FormaPagamento) {
    const confirmMessage = forma.ativo
      ? `Desativar a forma de pagamento ${forma.nome}?`
      : `Reativar a forma de pagamento ${forma.nome}?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    startTransition(async () => {
      const result = await atualizarFormaPagamento(forma.id, { nome: forma.nome, ativo: !forma.ativo })
      setFeedback({
        id: forma.id,
        message: result.error ?? 'Status atualizado.',
        isError: Boolean(result.error),
      })
    })
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Nome</th>
            <th className="px-4 py-2 font-medium">Situação</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {formas.map((forma) => (
            <tr key={forma.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2">
                {editingId === forma.id ? (
                  <EditForm
                    forma={forma}
                    pending={isPending}
                    onCancel={() => setEditingId(null)}
                    onSave={(nome) => {
                      startTransition(async () => {
                        const result = await atualizarFormaPagamento(forma.id, {
                          nome,
                          ativo: forma.ativo,
                        })
                        setFeedback({
                          id: forma.id,
                          message: result.error ?? 'Forma de pagamento atualizada.',
                          isError: Boolean(result.error),
                        })
                        if (!result.error) {
                          setEditingId(null)
                        }
                      })
                    }}
                  />
                ) : (
                  forma.nome
                )}
              </td>
              <td className="px-4 py-2">
                <span className={forma.ativo ? 'text-green-700' : 'text-slate-400'}>
                  {forma.ativo ? 'Ativa' : 'Inativa'}
                </span>
              </td>
              <td className="space-x-2 px-4 py-2">
                {editingId !== forma.id && (
                  <button
                    type="button"
                    onClick={() => setEditingId(forma.id)}
                    className="text-slate-700 underline"
                  >
                    Editar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleToggleAtivo(forma)}
                  disabled={isPending}
                  className="text-slate-700 underline disabled:opacity-50"
                >
                  {forma.ativo ? 'Desativar' : 'Reativar'}
                </button>
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
  forma,
  pending,
  onSave,
  onCancel,
}: {
  forma: FormaPagamento
  pending: boolean
  onSave: (nome: string) => void
  onCancel: () => void
}) {
  const [nome, setNome] = useState(forma.nome)

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
