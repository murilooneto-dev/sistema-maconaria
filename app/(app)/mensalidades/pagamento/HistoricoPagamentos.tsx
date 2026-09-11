'use client'

import { useState, useTransition } from 'react'
import { cancelarPagamento } from './actions'
import { gerarRecibo } from '../../recibos/actions'
import { AnexosExpandable } from '@/components/anexos/AnexosExpandable'
import type { AnexoItem } from '@/components/anexos/AnexosList'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'

type Pagamento = {
  id: string
  valor_total: number
  data_pagamento: string
  status: string
  motivo_cancelamento: string | null
}

export function HistoricoPagamentos({
  pagamentos,
  anexosPorPagamento,
  podeExcluirAnexo,
}: {
  pagamentos: Pagamento[]
  anexosPorPagamento: Record<string, AnexoItem[]>
  podeExcluirAnexo: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ id: string; message: string; isError: boolean } | null>(null)
  const [recibosGerados, setRecibosGerados] = useState<Record<string, string>>({})

  function handleCancelar(pagamento: Pagamento) {
    const motivo = window.prompt(`Motivo do cancelamento do pagamento de ${formatarDataBR(pagamento.data_pagamento)}:`)
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

  function handleGerarRecibo(pagamento: Pagamento) {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('tipo', 'MENSALIDADE')
      formData.set('pagamentoId', pagamento.id)

      const result = await gerarRecibo(undefined, formData)
      if (result && 'success' in result) {
        setRecibosGerados((atual) => ({ ...atual, [pagamento.id]: result.reciboId }))
        setFeedback({ id: pagamento.id, message: result.success, isError: false })
      } else {
        setFeedback({ id: pagamento.id, message: result?.error ?? 'Falha ao gerar recibo.', isError: true })
      }
    })
  }

  if (pagamentos.length === 0) {
    return null
  }

  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Data</th>
            <th className="px-4 py-2 font-medium">Valor total</th>
            <th className="px-4 py-2 font-medium">Situação</th>
            <th className="px-4 py-2 font-medium">Anexos</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {pagamentos.map((pagamento) => (
            <tr key={pagamento.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2">{formatarDataBR(pagamento.data_pagamento)}</td>
              <td className="px-4 py-2">
                {formatarMoedaBR(pagamento.valor_total)}
              </td>
              <td className="px-4 py-2">
                <span className={pagamento.status === 'ATIVO' ? 'text-green-700' : 'text-slate-400'}>
                  {pagamento.status}
                </span>
              </td>
              <td className="px-4 py-2">
                <AnexosExpandable anexos={anexosPorPagamento[pagamento.id] ?? []} podeExcluir={podeExcluirAnexo} />
              </td>
              <td className="px-4 py-2">
                {pagamento.status === 'ATIVO' && (
                  <div className="flex items-center gap-3">
                    {recibosGerados[pagamento.id] ? (
                      <a
                        href={`/recibos/${recibosGerados[pagamento.id]}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-700 underline"
                      >
                        Ver recibo
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleGerarRecibo(pagamento)}
                        className="text-slate-700 underline disabled:opacity-50"
                      >
                        Gerar recibo
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleCancelar(pagamento)}
                      className="text-slate-700 underline disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
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
