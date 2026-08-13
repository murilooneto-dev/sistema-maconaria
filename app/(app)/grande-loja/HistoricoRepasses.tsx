'use client'

import { Fragment, useState, useTransition } from 'react'
import { cancelarRepasse } from './actions'
import { formatarDataBR, abreviarMes } from '@/lib/format'

type Repasse = {
  id: string
  data_envio: string
  valor_total: number
  observacao: string | null
  status: string
  contas: { nome: string }[] | { nome: string } | null
  profiles: { nome: string }[] | { nome: string } | null
}

type ItemRepasse = {
  id: string
  valor: number
  mensalidades:
    | { ano: number; mes: number; membros: { nome: string }[] | { nome: string } | null }[]
    | { ano: number; mes: number; membros: { nome: string }[] | { nome: string } | null }
    | null
}

function primeiro<T>(rel: T[] | T | null): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

function nomeRelacionado(rel: { nome: string }[] | { nome: string } | null): string {
  const item = primeiro(rel)
  return item?.nome ?? '-'
}

function membroDoItem(item: ItemRepasse): string {
  const m = primeiro(item.mensalidades)
  if (!m) return '-'
  return nomeRelacionado(m.membros)
}

function competenciaDoItem(item: ItemRepasse): string {
  const m = primeiro(item.mensalidades)
  if (!m) return '-'
  return `${abreviarMes(m.mes)}/${m.ano}`
}

export function HistoricoRepasses({
  repasses,
  itensPorRepasse,
  podeEditar,
  filtro,
}: {
  repasses: Repasse[]
  itensPorRepasse: Record<string, ItemRepasse[]>
  podeEditar: boolean
  filtro: { ano?: string; mes?: string }
}) {
  const [isPending, startTransition] = useTransition()
  const [expandido, setExpandido] = useState<string | null>(null)

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
              {repasses.map((r) => {
                const itens = itensPorRepasse[r.id] ?? []
                const aberto = expandido === r.id
                return (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => setExpandido(aberto ? null : r.id)}
                      className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-2">{formatarDataBR(r.data_envio)}</td>
                      <td className="px-4 py-2">{nomeRelacionado(r.contas)}</td>
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
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCancelar(r.id)
                              }}
                              className="text-slate-700 underline disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                    {aberto && (
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <td colSpan={podeEditar ? 5 : 4} className="px-4 py-3">
                          <div className="space-y-2">
                            <p className="text-xs text-slate-500">
                              Enviado por <span className="font-medium">{nomeRelacionado(r.profiles)}</span>
                              {r.observacao && <> — {r.observacao}</>}
                            </p>
                            {itens.length === 0 ? (
                              <p className="text-xs text-slate-400">Nenhum item encontrado para este repasse.</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead className="text-left text-slate-500">
                                  <tr>
                                    <th className="py-1 pr-4 font-medium">Membro</th>
                                    <th className="py-1 pr-4 font-medium">Competência</th>
                                    <th className="py-1 pr-4 font-medium">Valor GL</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itens.map((item) => (
                                    <tr key={item.id}>
                                      <td className="py-1 pr-4">{membroDoItem(item)}</td>
                                      <td className="py-1 pr-4">{competenciaDoItem(item)}</td>
                                      <td className="py-1 pr-4">R$ {Number(item.valor).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
