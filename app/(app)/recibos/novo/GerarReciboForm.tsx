'use client'

import { useActionState } from 'react'
import { gerarRecibo } from '../actions'
import { formatarDataBR } from '@/lib/format'

type Pagamento = { id: string; valor_total: number; data_pagamento: string }
type Doacao = { id: string; doador: string; valor: number; data: string }

export function GerarReciboForm({
  tipo,
  pagamentos,
  doacoes,
}: {
  tipo: 'MENSALIDADE' | 'CAMPANHA'
  pagamentos: Pagamento[]
  doacoes: Doacao[]
}) {
  const [state, formAction, pending] = useActionState(gerarRecibo, undefined)

  const opcoes = tipo === 'MENSALIDADE' ? pagamentos : doacoes

  if (opcoes.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum {tipo === 'MENSALIDADE' ? 'pagamento' : 'doação'} ativo encontrado.</p>
  }

  return (
    <form action={formAction} className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <input type="hidden" name="tipo" value={tipo} />

      <div className="space-y-2">
        {tipo === 'MENSALIDADE'
          ? pagamentos.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="radio" name="pagamentoId" value={p.id} required />
                {formatarDataBR(p.data_pagamento)} — R$ {Number(p.valor_total).toFixed(2)}
              </label>
            ))
          : doacoes.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm">
                <input type="radio" name="doacaoId" value={d.id} required />
                {formatarDataBR(d.data)} — {d.doador} — R$ {Number(d.valor).toFixed(2)}
              </label>
            ))}
      </div>

      <div className="space-y-1">
        <label htmlFor="descricao" className="text-sm font-medium text-slate-700">
          Descrição (opcional)
        </label>
        <textarea
          id="descricao"
          name="descricao"
          rows={2}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {state && 'error' in state && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state && 'success' in state && (
        <p className="text-sm text-green-700" role="status">
          {state.success}{' '}
          <a href={`/recibos/${state.reciboId}/pdf`} target="_blank" rel="noopener noreferrer" className="underline">
            Baixar PDF
          </a>
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Gerando...' : 'Gerar recibo'}
      </button>
    </form>
  )
}
