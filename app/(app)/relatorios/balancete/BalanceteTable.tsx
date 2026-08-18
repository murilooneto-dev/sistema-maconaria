'use client'

import { Fragment, useState } from 'react'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'
import type { Balancete } from '@/lib/relatorios/balancete'

export function BalanceteTable({ balancete }: { balancete: Balancete }) {
  const [expandido, setExpandido] = useState<string | null>(null)

  const temMovimentacao = balancete.grupos.some((g) => g.categorias.length > 0)

  if (!temMovimentacao) {
    return <p className="text-sm text-slate-500">Nenhuma movimentação encontrada para o período selecionado.</p>
  }

  return (
    <div className="space-y-6">
      {balancete.grupos.map((grupo) => {
        if (grupo.categorias.length === 0) return null

        return (
          <div key={grupo.tipo} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">{grupo.label}</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {grupo.categorias.map((categoria) => {
                  const chave = `${grupo.tipo}:${categoria.id}`
                  const aberto = expandido === chave
                  return (
                    <Fragment key={chave}>
                      <tr
                        onClick={() => setExpandido(aberto ? null : chave)}
                        className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                      >
                        <td className="px-4 py-2 font-medium text-slate-900">{categoria.nome}</td>
                        <td className="px-4 py-2 text-right">{formatarMoedaBR(categoria.total)}</td>
                      </tr>
                      {aberto && (
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <td colSpan={2} className="px-4 py-3">
                            <table className="w-full text-xs">
                              <thead className="text-left text-slate-500">
                                <tr>
                                  <th className="py-1 pr-4 font-medium">Data</th>
                                  <th className="py-1 pr-4 font-medium">Descrição</th>
                                  <th className="py-1 pr-4 font-medium">Conta</th>
                                  <th className="py-1 pr-4 font-medium">Forma</th>
                                  <th className="py-1 pr-4 text-right font-medium">Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {categoria.lancamentos.map((lanc, i) => (
                                  <tr key={i}>
                                    <td className="py-1 pr-4">{formatarDataBR(lanc.data)}</td>
                                    <td className="py-1 pr-4">{lanc.descricao}</td>
                                    <td className="py-1 pr-4">{lanc.conta}</td>
                                    <td className="py-1 pr-4">{lanc.formaPagamento}</td>
                                    <td className="py-1 pr-4 text-right">{formatarMoedaBR(lanc.valor)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                <tr className="bg-slate-100 font-semibold text-slate-900">
                  <td className="px-4 py-2">Subtotal {grupo.label.toLowerCase()}</td>
                  <td className="px-4 py-2 text-right">{formatarMoedaBR(grupo.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
