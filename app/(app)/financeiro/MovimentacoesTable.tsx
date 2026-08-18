'use client'

import { useState, useTransition } from 'react'
import { cancelarMovimentacao } from './actions'
import { AnexosExpandable } from '@/components/anexos/AnexosExpandable'
import type { AnexoItem } from '@/components/anexos/AnexosList'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'

type Movimentacao = {
  id: string
  data: string
  tipo: string
  descricao: string | null
  valor: number
  origem: string
  status: string
  motivo_cancelamento: string | null
  categorias_movimentacao: { nome: string }[] | { nome: string } | null
  contas: { nome: string }[] | { nome: string } | null
  formas_pagamento: { nome: string }[] | { nome: string } | null
  membros: { nome: string }[] | { nome: string } | null
}

function nomeRelacionado(rel: { nome: string }[] | { nome: string } | null): string {
  if (!rel) return '-'
  return Array.isArray(rel) ? (rel[0]?.nome ?? '-') : rel.nome
}

export function MovimentacoesTable({
  movimentacoes,
  podeEditar,
  anexosPorMovimentacao,
}: {
  movimentacoes: Movimentacao[]
  podeEditar: boolean
  anexosPorMovimentacao: Record<string, AnexoItem[]>
}) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ id: string; message: string; isError: boolean } | null>(
    null
  )

  function handleCancelar(mov: Movimentacao) {
    const motivo = window.prompt(`Motivo do cancelamento da movimentação de R$ ${mov.valor}:`)
    if (motivo === null) return
    if (motivo.trim().length === 0) {
      setFeedback({ id: mov.id, message: 'Informe o motivo do cancelamento.', isError: true })
      return
    }

    startTransition(async () => {
      const result = await cancelarMovimentacao(mov.id, motivo)
      setFeedback({
        id: mov.id,
        message: result.error ?? 'Movimentação cancelada.',
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
            <th className="px-4 py-2 font-medium">Tipo</th>
            <th className="px-4 py-2 font-medium">Categoria</th>
            <th className="px-4 py-2 font-medium">Descrição</th>
            <th className="px-4 py-2 font-medium">Conta</th>
            <th className="px-4 py-2 font-medium">Forma</th>
            <th className="px-4 py-2 font-medium">Membro</th>
            <th className="px-4 py-2 font-medium">Valor</th>
            <th className="px-4 py-2 font-medium">Situação</th>
            <th className="px-4 py-2 font-medium">Anexos</th>
            {podeEditar && <th className="px-4 py-2 font-medium">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {movimentacoes.map((mov) => (
            <tr key={mov.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2">{formatarDataBR(mov.data)}</td>
              <td className={`px-4 py-2 ${mov.tipo === 'ENTRADA' ? 'text-green-700' : 'text-red-700'}`}>
                {mov.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}
              </td>
              <td className="px-4 py-2">{nomeRelacionado(mov.categorias_movimentacao)}</td>
              <td className="px-4 py-2">{mov.descricao ?? '-'}</td>
              <td className="px-4 py-2">{nomeRelacionado(mov.contas)}</td>
              <td className="px-4 py-2">{nomeRelacionado(mov.formas_pagamento)}</td>
              <td className="px-4 py-2">{nomeRelacionado(mov.membros)}</td>
              <td className="px-4 py-2">{formatarMoedaBR(Number(mov.valor))}</td>
              <td className="px-4 py-2">
                {mov.status === 'ATIVO' ? (
                  <span className="text-green-700">Ativa</span>
                ) : (
                  <span className="text-slate-400" title={mov.motivo_cancelamento ?? ''}>
                    Cancelada
                  </span>
                )}
              </td>
              <td className="px-4 py-2">
                <AnexosExpandable anexos={anexosPorMovimentacao[mov.id] ?? []} podeExcluir={podeEditar} />
              </td>
              {podeEditar && (
                <td className="px-4 py-2">
                  {mov.status === 'ATIVO' && mov.origem !== 'MENSALIDADE' && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleCancelar(mov)}
                      className="text-slate-700 underline disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  )}
                  {mov.status === 'ATIVO' && mov.origem === 'MENSALIDADE' && (
                    <span className="text-xs text-slate-400">via Mensalidades</span>
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
