'use client'

import { useActionState, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { gerarRecibo } from '../recibos/actions'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'

type Movimentacao = {
  id: string
  data: string
  tipo: string
  descricao: string | null
  valor: number
  origem: string
  status: string
  membros: { nome: string }[] | { nome: string } | null
  categorias_movimentacao: { nome: string }[] | { nome: string } | null
}

function nomeRelacionado(rel: { nome: string }[] | { nome: string } | null): string | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0]?.nome ?? null) : rel.nome
}

export function GerarReciboModal({ movimentacoes }: { movimentacoes: Movimentacao[] }) {
  const [aberto, setAberto] = useState(false)

  const elegiveis = useMemo(
    () => movimentacoes.filter((m) => m.tipo === 'ENTRADA' && m.status === 'ATIVO' && m.origem === 'MANUAL'),
    [movimentacoes]
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Gerar recibo
      </button>

      {aberto &&
        createPortal(<ModalConteudo elegiveis={elegiveis} onClose={() => setAberto(false)} />, document.body)}
    </>
  )
}

function ModalConteudo({ elegiveis, onClose }: { elegiveis: Movimentacao[]; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(gerarRecibo, undefined)
  const [selecionada, setSelecionada] = useState<Movimentacao | null>(null)

  const sucesso = state && 'success' in state

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Gerar recibo</h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 underline">
            Fechar
          </button>
        </div>

        {sucesso ? (
          <div className="space-y-3">
            <p className="text-sm text-green-700" role="status">
              {state.success}
            </p>
            <a
              href={`/recibos/${state.reciboId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Baixar PDF
            </a>
          </div>
        ) : elegiveis.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma entrada manual ativa encontrada para gerar recibo.</p>
        ) : (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="tipo" value="MOVIMENTACAO" />

            <div className="max-h-64 space-y-2 overflow-y-auto rounded border border-slate-200 p-3">
              {elegiveis.map((m) => {
                const membroNome = nomeRelacionado(m.membros)
                const categoriaNome = nomeRelacionado(m.categorias_movimentacao)
                return (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="movimentacaoId"
                      value={m.id}
                      required
                      onChange={() => setSelecionada(m)}
                    />
                    {formatarDataBR(m.data)} — {categoriaNome ?? 'Sem categoria'}
                    {m.descricao ? ` — ${m.descricao}` : ''}
                    {membroNome ? ` — ${membroNome}` : ''} — {formatarMoedaBR(Number(m.valor))}
                  </label>
                )
              })}
            </div>

            {selecionada && (
              <>
                <div className="space-y-1">
                  <label htmlFor="pessoa" className="text-sm font-medium text-slate-700">
                    Pessoa
                  </label>
                  <input
                    id="pessoa"
                    name="pessoa"
                    type="text"
                    key={selecionada.id}
                    defaultValue={nomeRelacionado(selecionada.membros) ?? ''}
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
                    key={`${selecionada.id}-referencia`}
                    defaultValue={nomeRelacionado(selecionada.categorias_movimentacao) ?? selecionada.descricao ?? ''}
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

            <button
              type="submit"
              disabled={pending}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? 'Gerando...' : 'Gerar recibo'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
