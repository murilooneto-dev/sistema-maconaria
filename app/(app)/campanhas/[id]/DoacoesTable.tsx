'use client'

import { useState, useTransition } from 'react'
import { cancelarDoacao } from './actions'

type Doacao = {
  id: string
  doador: string
  valor: number
  data: string
  observacao: string | null
  status: string
  motivo_cancelamento: string | null
  membros: { nome: string }[] | { nome: string } | null
}

function nomeMembro(rel: Doacao['membros']): string {
  if (!rel) return '-'
  return Array.isArray(rel) ? (rel[0]?.nome ?? '-') : rel.nome
}

export function DoacoesTable({ doacoes, podeEditar }: { doacoes: Doacao[]; podeEditar: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ id: string; message: string; isError: boolean } | null>(
    null
  )

  function handleCancelar(d: Doacao) {
    const motivo = window.prompt(`Motivo do cancelamento da doação de ${d.doador} (R$ ${d.valor}):`)
    if (motivo === null) return
    if (motivo.trim().length === 0) {
      setFeedback({ id: d.id, message: 'Informe o motivo do cancelamento.', isError: true })
      return
    }

    startTransition(async () => {
      const result = await cancelarDoacao(d.id, motivo)
      setFeedback({
        id: d.id,
        message: result.error ?? 'Doação cancelada.',
        isError: Boolean(result.error),
      })
    })
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Data</th>
            <th className="px-4 py-2 font-medium">Doador</th>
            <th className="px-4 py-2 font-medium">Membro</th>
            <th className="px-4 py-2 font-medium">Valor</th>
            <th className="px-4 py-2 font-medium">Situação</th>
            {podeEditar && <th className="px-4 py-2 font-medium">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {doacoes.map((d) => (
            <tr key={d.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2">{d.data}</td>
              <td className="px-4 py-2">{d.doador}</td>
              <td className="px-4 py-2">{nomeMembro(d.membros)}</td>
              <td className="px-4 py-2">R$ {Number(d.valor).toFixed(2)}</td>
              <td className="px-4 py-2">
                {d.status === 'ATIVO' ? (
                  <span className="text-green-700">Ativa</span>
                ) : (
                  <span className="text-slate-400" title={d.motivo_cancelamento ?? ''}>
                    Cancelada
                  </span>
                )}
              </td>
              {podeEditar && (
                <td className="px-4 py-2">
                  {d.status === 'ATIVO' && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleCancelar(d)}
                      className="text-slate-700 underline disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  )}
                </td>
              )}
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
