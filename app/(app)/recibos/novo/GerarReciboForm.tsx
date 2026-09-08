'use client'

import { useActionState, useState } from 'react'
import { gerarRecibo } from '../actions'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'

type Pagamento = { id: string; valor_total: number; data_pagamento: string }
type Doacao = { id: string; doador: string; valor: number; data: string }
type Movimentacao = {
  id: string
  data: string
  valor: number
  descricao: string | null
  membroId: string | null
  membroNome: string | null
  categoriaNome: string | null
}

export function GerarReciboForm({
  tipo,
  pagamentos,
  doacoes,
  movimentacoes,
}: {
  tipo: 'MENSALIDADE' | 'CAMPANHA' | 'MOVIMENTACAO'
  pagamentos: Pagamento[]
  doacoes: Doacao[]
  movimentacoes: Movimentacao[]
}) {
  const [state, formAction, pending] = useActionState(gerarRecibo, undefined)
  const [movimentacaoSelecionada, setMovimentacaoSelecionada] = useState<Movimentacao | null>(null)

  const opcoes = tipo === 'MENSALIDADE' ? pagamentos : tipo === 'CAMPANHA' ? doacoes : movimentacoes

  if (opcoes.length === 0) {
    const rotulo = tipo === 'MENSALIDADE' ? 'pagamento' : tipo === 'CAMPANHA' ? 'doação' : 'entrada manual'
    return <p className="text-sm text-slate-500">Nenhum {rotulo} ativo encontrado.</p>
  }

  return (
    <form action={formAction} className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <input type="hidden" name="tipo" value={tipo} />

      <div className="space-y-2">
        {tipo === 'MENSALIDADE' &&
          pagamentos.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input type="radio" name="pagamentoId" value={p.id} required />
              {formatarDataBR(p.data_pagamento)} — {formatarMoedaBR(Number(p.valor_total))}
            </label>
          ))}
        {tipo === 'CAMPANHA' &&
          doacoes.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm">
              <input type="radio" name="doacaoId" value={d.id} required />
              {formatarDataBR(d.data)} — {d.doador} — {formatarMoedaBR(Number(d.valor))}
            </label>
          ))}
        {tipo === 'MOVIMENTACAO' &&
          movimentacoes.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="movimentacaoId"
                value={m.id}
                required
                onChange={() => setMovimentacaoSelecionada(m)}
              />
              {formatarDataBR(m.data)} — {m.categoriaNome ?? 'Sem categoria'}
              {m.descricao ? ` — ${m.descricao}` : ''}
              {m.membroNome ? ` — ${m.membroNome}` : ''} — {formatarMoedaBR(m.valor)}
            </label>
          ))}
      </div>

      {tipo === 'MOVIMENTACAO' && movimentacaoSelecionada && (
        <>
          <div className="space-y-1">
            <label htmlFor="pessoa" className="text-sm font-medium text-slate-700">
              Pessoa
            </label>
            <input
              id="pessoa"
              name="pessoa"
              type="text"
              key={movimentacaoSelecionada.id}
              defaultValue={movimentacaoSelecionada.membroNome ?? ''}
              placeholder="Nome de quem recebeu o valor"
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="referencia" className="text-sm font-medium text-slate-700">
              Referente a
            </label>
            <input
              id="referencia"
              name="referencia"
              type="text"
              key={`${movimentacaoSelecionada.id}-referencia`}
              defaultValue={movimentacaoSelecionada.categoriaNome ?? movimentacaoSelecionada.descricao ?? ''}
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </>
      )}

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
