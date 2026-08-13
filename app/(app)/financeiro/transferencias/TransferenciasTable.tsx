'use client'

import { useState, useTransition } from 'react'
import { cancelarTransferencia } from './actions'

type Transferencia = {
  id: string
  data: string
  valor: number
  observacao: string | null
  status: string
  motivo_cancelamento: string | null
  conta_origem: { nome: string }[] | { nome: string } | null
  conta_destino: { nome: string }[] | { nome: string } | null
}

function nomeRelacionado(rel: { nome: string }[] | { nome: string } | null): string {
  if (!rel) return '-'
  return Array.isArray(rel) ? (rel[0]?.nome ?? '-') : rel.nome
}

export function TransferenciasTable({
  transferencias,
  podeEditar,
}: {
  transferencias: Transferencia[]
  podeEditar: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ id: string; message: string; isError: boolean } | null>(
    null
  )

  function handleCancelar(t: Transferencia) {
    const motivo = window.prompt(`Motivo do cancelamento da transferência de R$ ${t.valor}:`)
    if (motivo === null) return
    if (motivo.trim().length === 0) {
      setFeedback({ id: t.id, message: 'Informe o motivo do cancelamento.', isError: true })
      return
    }

    startTransition(async () => {
      const result = await cancelarTransferencia(t.id, motivo)
      setFeedback({
        id: t.id,
        message: result.error ?? 'Transferência cancelada.',
        isError: Boolean(result.error),
      })
    })
  }

  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Data</th>
            <th className="px-4 py-2 font-medium">Origem</th>
            <th className="px-4 py-2 font-medium">Destino</th>
            <th className="px-4 py-2 font-medium">Valor</th>
            <th className="px-4 py-2 font-medium">Situação</th>
            {podeEditar && <th className="px-4 py-2 font-medium">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {transferencias.map((t) => (
            <tr key={t.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2">{t.data}</td>
              <td className="px-4 py-2">{nomeRelacionado(t.conta_origem)}</td>
              <td className="px-4 py-2">{nomeRelacionado(t.conta_destino)}</td>
              <td className="px-4 py-2">R$ {Number(t.valor).toFixed(2)}</td>
              <td className="px-4 py-2">
                {t.status === 'ATIVO' ? (
                  <span className="text-green-700">Ativa</span>
                ) : (
                  <span className="text-slate-400" title={t.motivo_cancelamento ?? ''}>
                    Cancelada
                  </span>
                )}
              </td>
              {podeEditar && (
                <td className="px-4 py-2">
                  {t.status === 'ATIVO' && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleCancelar(t)}
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
