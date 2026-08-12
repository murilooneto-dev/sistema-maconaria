'use client'

import { useState, useTransition } from 'react'
import { cancelarPagamento } from './actions'

type Pagamento = {
  id: string
  valor_total: number
  data_pagamento: string
  status: string
  motivo_cancelamento: string | null
}

export function HistoricoPagamentos({ pagamentos }: { pagamentos: Pagamento[] }) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ id: string; message: string; isError: boolean } | null>(null)

  function handleCancelar(pagamento: Pagamento) {
    const motivo = window.prompt(`Motivo do cancelamento do pagamento de ${new Date(pagamento.data_pagamento).toLocaleDateString('pt-BR')}:`)
    if (!motivo) {
      return
    }

    startTransition(async () => {
      const result = await cancelarPagamento(pagamento.id, motivo)
      setFeedback({
        id: pagamento.id,
        message: result.error ?? 'Pagamento cancelado.',
        isError: Boolean(result.error),
      })
    })
  }

  if (pagamentos.length === 0) {
    return null
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Data</th>
            <th className="px-4 py-2 font-medium">Valor total</th>
            <th className="px-4 py-2 font-medium">Situação</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {pagamentos.map((pagamento) => (
            <tr key={pagamento.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2">{new Date(pagamento.data_pagamento).toLocaleDateString('pt-BR')}</td>
              <td className="px-4 py-2">
                {pagamento.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
              <td className="px-4 py-2">
                <span className={pagamento.status === 'ATIVO' ? 'text-green-700' : 'text-slate-400'}>
                  {pagamento.status}
                </span>
              </td>
              <td className="px-4 py-2">
                {pagamento.status === 'ATIVO' && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleCancelar(pagamento)}
                    className="text-slate-700 underline disabled:opacity-50"
                  >
                    Cancelar
                  </button>
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
