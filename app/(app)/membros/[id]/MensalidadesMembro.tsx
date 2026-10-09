'use client'

import { useState, useTransition } from 'react'
import { excluirMensalidades, reativarMensalidade } from '../../mensalidades/actions'
import { podeExcluirMensalidade } from '@/lib/domain/mensalidades'
import { formatarMoedaBR } from '@/lib/format'

type Mensalidade = {
  id: string
  ano: number
  mes: number
  valor_devido: number
  valor_pago: number
  status: string
}

const ROTULO_STATUS: Record<string, { texto: string; classe: string }> = {
  QUITADA: { texto: 'Quitada', classe: 'bg-green-100 text-green-800' },
  PARCIAL: { texto: 'Parcial', classe: 'bg-amber-100 text-amber-800' },
  PENDENTE: { texto: 'Pendente', classe: 'bg-red-100 text-red-800' },
  CANCELADA: { texto: 'Excluída', classe: 'bg-slate-100 text-slate-500' },
  NAO_APLICAVEL: { texto: 'Não aplicável', classe: 'bg-slate-50 text-slate-400' },
}

function competencia(m: Mensalidade): string {
  return `${String(m.mes).padStart(2, '0')}/${m.ano}`
}

export function MensalidadesMembro({
  membroId,
  mensalidades,
  podeGerenciar,
}: {
  membroId: string
  mensalidades: Mensalidade[]
  podeGerenciar: boolean
}) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null)

  const excluiveis = mensalidades.filter((m) => podeExcluirMensalidade(m).valido)

  function alternar(id: string) {
    setSelecionadas((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function alternarTodas() {
    setSelecionadas((atual) =>
      atual.size === excluiveis.length ? new Set() : new Set(excluiveis.map((m) => m.id))
    )
  }

  function handleExcluir() {
    const alvo = mensalidades.filter((m) => selecionadas.has(m.id))
    const motivo = window.prompt(
      `Excluir ${alvo.length} mensalidade(s): ${alvo.map(competencia).join(', ')}.\n\nElas deixam de ser cobradas e de contar como inadimplência. Informe o motivo:`
    )
    if (motivo === null) return
    if (motivo.trim().length === 0) {
      setFeedback({ message: 'Informe o motivo da exclusão.', isError: true })
      return
    }

    startTransition(async () => {
      const result = await excluirMensalidades(membroId, [...selecionadas], motivo)
      setFeedback({
        message: result.error ?? `${result.excluidas} mensalidade(s) excluída(s).`,
        isError: Boolean(result.error),
      })
      setSelecionadas(new Set())
    })
  }

  function handleReativar(m: Mensalidade) {
    if (!window.confirm(`Reativar a mensalidade ${competencia(m)}? Ela volta a ser cobrada.`)) return
    startTransition(async () => {
      const result = await reativarMensalidade(membroId, m.id)
      setFeedback({
        message: result.error ?? `Mensalidade ${competencia(m)} reativada.`,
        isError: Boolean(result.error),
      })
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Mensalidades</h2>
        {podeGerenciar && excluiveis.length > 0 && (
          <button
            type="button"
            disabled={isPending || selecionadas.size === 0}
            onClick={handleExcluir}
            className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
          >
            {isPending ? 'Processando...' : `Excluir selecionadas (${selecionadas.size})`}
          </button>
        )}
      </div>

      {mensalidades.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma mensalidade gerada para este membro.</p>
      ) : (
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="sticky top-0 bg-white text-left text-slate-500">
              <tr>
                {podeGerenciar && (
                  <th className="py-2 pr-2">
                    {excluiveis.length > 0 && (
                      <input
                        type="checkbox"
                        aria-label="Selecionar todas as mensalidades que podem ser excluídas"
                        checked={selecionadas.size > 0 && selecionadas.size === excluiveis.length}
                        onChange={alternarTodas}
                      />
                    )}
                  </th>
                )}
                <th className="py-2 font-medium">Competência</th>
                <th className="py-2 font-medium">Devido</th>
                <th className="py-2 font-medium">Pago</th>
                <th className="py-2 font-medium">Situação</th>
                {podeGerenciar && <th className="py-2 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {mensalidades.map((m) => {
                const rotulo = ROTULO_STATUS[m.status] ?? { texto: m.status, classe: 'bg-slate-50 text-slate-500' }
                const excluivel = podeExcluirMensalidade(m).valido
                return (
                  <tr key={m.id} className="border-t border-slate-100">
                    {podeGerenciar && (
                      <td className="py-2 pr-2">
                        {excluivel && (
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${competencia(m)}`}
                            checked={selecionadas.has(m.id)}
                            onChange={() => alternar(m.id)}
                          />
                        )}
                      </td>
                    )}
                    <td className={`py-2 ${m.status === 'CANCELADA' ? 'text-slate-400 line-through' : ''}`}>
                      {competencia(m)}
                    </td>
                    <td className="py-2">{formatarMoedaBR(Number(m.valor_devido))}</td>
                    <td className="py-2">{formatarMoedaBR(Number(m.valor_pago))}</td>
                    <td className="py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs ${rotulo.classe}`}>{rotulo.texto}</span>
                    </td>
                    {podeGerenciar && (
                      <td className="py-2 text-right">
                        {m.status === 'CANCELADA' && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleReativar(m)}
                            className="text-slate-700 underline disabled:opacity-50"
                          >
                            Reativar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {podeGerenciar && mensalidades.some((m) => m.status === 'PARCIAL' || m.status === 'QUITADA') && (
        <p className="text-xs text-slate-500">
          Mensalidade com pagamento não pode ser excluída — cancele o pagamento antes, em Mensalidades → Registrar
          pagamento.
        </p>
      )}

      {feedback && (
        <p
          className={`text-sm ${feedback.isError ? 'text-red-600' : 'text-green-700'}`}
          role={feedback.isError ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      )}
    </div>
  )
}
