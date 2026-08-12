'use client'

import { useTransition } from 'react'
import { cancelarRepasse } from './actions'

type Repasse = {
  id: string
  data_envio: string
  valor_total: number
  observacao: string | null
  status: string
  contas: { nome: string }[] | { nome: string } | null
}

function nomeConta(rel: Repasse['contas']): string {
  if (!rel) return '-'
  return Array.isArray(rel) ? (rel[0]?.nome ?? '-') : rel.nome
}

export function HistoricoRepasses({
  repasses,
  podeEditar,
  filtro,
}: {
  repasses: Repasse[]
  podeEditar: boolean
  filtro: { ano?: string; mes?: string }
}) {
  const [isPending, startTransition] = useTransition()

  function handleCancelar(id: string) {
    if (!window.confirm('Cancelar este repasse? Os itens voltam a ficar pendentes.')) return
    startTransition(async () => {
      const result = await cancelarRepasse(id)
      if (result.error) {
        window.alert(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-900">Histórico de repasses</h2>

      <form className="flex items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Ano</label>
          <input
            type="number"
            name="ano"
            defaultValue={filtro.ano}
            className="w-24 rounded border border-slate-300 px-2 py-1"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Mês</label>
          <input
            type="number"
            name="mes"
            min={1}
            max={12}
            defaultValue={filtro.mes}
            className="w-20 rounded border border-slate-300 px-2 py-1"
          />
        </div>
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Filtrar
        </button>
      </form>

      {repasses.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum repasse encontrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">Conta</th>
                <th className="px-4 py-2 font-medium">Valor total</th>
                <th className="px-4 py-2 font-medium">Situação</th>
                {podeEditar && <th className="px-4 py-2 font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {repasses.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">{r.data_envio}</td>
                  <td className="px-4 py-2">{nomeConta(r.contas)}</td>
                  <td className="px-4 py-2">R$ {Number(r.valor_total).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    {r.status === 'ENVIADO' ? (
                      <span className="text-green-700">Enviado</span>
                    ) : (
                      <span className="text-slate-400">Cancelado</span>
                    )}
                  </td>
                  {podeEditar && (
                    <td className="px-4 py-2">
                      {r.status === 'ENVIADO' && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleCancelar(r.id)}
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
        </div>
      )}
    </div>
  )
}
