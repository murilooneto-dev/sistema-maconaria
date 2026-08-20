'use client'

import { Fragment, useState } from 'react'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'
import type { CentroDeCustoDetalhado } from '@/lib/relatorios/centros-de-custo-relatorio'

export function CentrosDeCustoRelatorioTable({ centros }: { centros: CentroDeCustoDetalhado[] }) {
  const [centroAberto, setCentroAberto] = useState<string | null>(null)
  const [categoriaAberta, setCategoriaAberta] = useState<string | null>(null)

  const centrosComMovimentacao = centros.filter((c) => c.categorias.length > 0)

  if (centrosComMovimentacao.length === 0) {
    return <p className="text-sm text-slate-500">Nenhuma movimentação encontrada para o período selecionado.</p>
  }

  return (
    <div className="space-y-4">
      {centrosComMovimentacao.map((centro) => {
        const aberto = centroAberto === centro.id
        return (
          <div key={centro.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setCentroAberto(aberto ? null : centro.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
            >
              <span className="flex items-center gap-2 font-medium text-slate-900">
                <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: centro.cor }} />
                {centro.nome}
              </span>
              <span className="flex gap-4 text-sm">
                <span className="text-green-700">{formatarMoedaBR(centro.totalEntradas)}</span>
                <span className="text-red-700">{formatarMoedaBR(centro.totalSaidas)}</span>
                <span className="font-semibold text-slate-900">{formatarMoedaBR(centro.saldo)}</span>
              </span>
            </button>

            {aberto && (
              <table className="w-full border-t border-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Categoria</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {centro.categorias.map((categoria) => {
                    const chave = `${centro.id}:${categoria.nome}:${categoria.tipo}`
                    const categoriaAbertaAqui = categoriaAberta === chave
                    return (
                      <Fragment key={chave}>
                        <tr
                          onClick={() => setCategoriaAberta(categoriaAbertaAqui ? null : chave)}
                          className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                        >
                          <td className="px-4 py-2 text-slate-900">{categoria.nome}</td>
                          <td
                            className={`px-4 py-2 text-right ${categoria.tipo === 'ENTRADA' ? 'text-green-700' : 'text-red-700'}`}
                          >
                            {formatarMoedaBR(categoria.total)}
                          </td>
                        </tr>
                        {categoriaAbertaAqui && (
                          <tr className="border-b border-slate-100 bg-slate-50">
                            <td colSpan={2} className="px-4 py-3">
                              <table className="w-full text-xs">
                                <thead className="text-left text-slate-500">
                                  <tr>
                                    <th className="py-1 pr-4 font-medium">Data</th>
                                    <th className="py-1 pr-4 font-medium">Descrição</th>
                                    <th className="py-1 pr-4 text-right font-medium">Valor</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {categoria.lancamentos.map((lanc, i) => (
                                    <tr key={i}>
                                      <td className="py-1 pr-4">{formatarDataBR(lanc.data)}</td>
                                      <td className="py-1 pr-4">{lanc.descricao}</td>
                                      <td
                                        className={`py-1 pr-4 text-right ${lanc.tipo === 'ENTRADA' ? 'text-green-700' : 'text-red-700'}`}
                                      >
                                        {formatarMoedaBR(lanc.valor)}
                                      </td>
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
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )
}
