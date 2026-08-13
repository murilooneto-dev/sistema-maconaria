'use client'

import { useState, useTransition } from 'react'
import { reabrirPeriodo } from './actions'

type Fechamento = {
  id: string
  ano: number
  mes: number
  saldo_inicial: number
  total_entradas: number
  total_saidas: number
  saldo_final: number
  status: string
  motivo_reabertura: string | null
}

export function HistoricoFechamentos({
  historico,
  maisRecenteFechadoId,
  isAdmin,
}: {
  historico: Fechamento[]
  maisRecenteFechadoId: string | null
  isAdmin: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ id: string; message: string; isError: boolean } | null>(
    null
  )

  function handleReabrir(f: Fechamento) {
    const motivo = window.prompt(`Motivo da reabertura do período ${f.mes}/${f.ano}:`)
    if (motivo === null) return
    if (motivo.trim().length === 0) {
      setFeedback({ id: f.id, message: 'Informe o motivo da reabertura.', isError: true })
      return
    }

    startTransition(async () => {
      const result = await reabrirPeriodo(f.id, motivo)
      setFeedback({
        id: f.id,
        message: result.error ?? 'Período reaberto.',
        isError: Boolean(result.error),
      })
    })
  }

  if (historico.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum fechamento realizado ainda.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Período</th>
            <th className="px-4 py-2 font-medium">Saldo inicial</th>
            <th className="px-4 py-2 font-medium">Entradas</th>
            <th className="px-4 py-2 font-medium">Saídas</th>
            <th className="px-4 py-2 font-medium">Saldo final</th>
            <th className="px-4 py-2 font-medium">Situação</th>
            {isAdmin && <th className="px-4 py-2 font-medium">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {historico.map((f) => (
            <tr key={f.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2">
                {String(f.mes).padStart(2, '0')}/{f.ano}
              </td>
              <td className="px-4 py-2">R$ {Number(f.saldo_inicial).toFixed(2)}</td>
              <td className="px-4 py-2 text-green-700">R$ {Number(f.total_entradas).toFixed(2)}</td>
              <td className="px-4 py-2 text-red-700">R$ {Number(f.total_saidas).toFixed(2)}</td>
              <td className="px-4 py-2">R$ {Number(f.saldo_final).toFixed(2)}</td>
              <td className="px-4 py-2">
                {f.status === 'FECHADO' ? (
                  <span className="text-green-700">Fechado</span>
                ) : (
                  <span className="text-amber-600" title={f.motivo_reabertura ?? ''}>
                    Reaberto
                  </span>
                )}
              </td>
              {isAdmin && (
                <td className="px-4 py-2">
                  {f.status === 'FECHADO' && f.id === maisRecenteFechadoId && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleReabrir(f)}
                      className="text-slate-700 underline disabled:opacity-50"
                    >
                      Reabrir
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
