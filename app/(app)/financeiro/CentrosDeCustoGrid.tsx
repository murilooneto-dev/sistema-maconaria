'use client'

import { useState } from 'react'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'
import type { CentroDeCustoResumo } from '@/lib/relatorios/centros-de-custo'

export function CentrosDeCustoGrid({ centros }: { centros: CentroDeCustoResumo[] }) {
  const [selecionado, setSelecionado] = useState<CentroDeCustoResumo | null>(null)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {centros.map((centro) => (
          <button
            key={centro.id}
            type="button"
            onClick={() => setSelecionado(centro)}
            className="rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: centro.cor }} />
              <h3 className="text-sm font-semibold text-slate-900">{centro.nome}</h3>
            </div>

            <ProporcaoBarra entradas={centro.totalEntradas} saidas={centro.totalSaidas} />

            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Entradas</dt>
                <dd className="font-medium text-green-700">{formatarMoedaBR(centro.totalEntradas)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Saídas</dt>
                <dd className="font-medium text-red-700">{formatarMoedaBR(centro.totalSaidas)}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-1">
                <dt className="text-slate-700">Saldo</dt>
                <dd className="font-semibold text-slate-900">{formatarMoedaBR(centro.saldo)}</dd>
              </div>
            </dl>
          </button>
        ))}
      </div>

      {selecionado && <DetalheModal centro={selecionado} onClose={() => setSelecionado(null)} />}
    </>
  )
}

function ProporcaoBarra({ entradas, saidas }: { entradas: number; saidas: number }) {
  const total = entradas + saidas
  const percEntradas = total > 0 ? (entradas / total) * 100 : 0

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-red-100">
      <div className="h-full bg-green-600" style={{ width: `${percEntradas}%` }} />
    </div>
  )
}

function DetalheModal({ centro, onClose }: { centro: CentroDeCustoResumo; onClose: () => void }) {
  const totalGeral = centro.totalEntradas + centro.totalSaidas

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: centro.cor }} />
            <h2 className="text-base font-semibold text-slate-900">{centro.nome}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 underline">
            Fechar
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Entradas</p>
            <p className="font-semibold text-green-700">{formatarMoedaBR(centro.totalEntradas)}</p>
          </div>
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Saídas</p>
            <p className="font-semibold text-red-700">{formatarMoedaBR(centro.totalSaidas)}</p>
          </div>
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Saldo</p>
            <p className="font-semibold text-slate-900">{formatarMoedaBR(centro.saldo)}</p>
          </div>
        </div>

        <h3 className="mb-2 text-sm font-semibold text-slate-900">Por categoria</h3>
        {centro.porCategoria.length === 0 ? (
          <p className="mb-4 text-sm text-slate-500">Nenhuma movimentação no período.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {centro.porCategoria.map((categoria) => {
              const percentual = totalGeral > 0 ? (categoria.valor / totalGeral) * 100 : 0
              return (
                <li key={categoria.categoriaId} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700">{categoria.nome}</span>
                    <span className={categoria.tipo === 'ENTRADA' ? 'font-medium text-green-700' : 'font-medium text-red-700'}>
                      {formatarMoedaBR(categoria.valor)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={categoria.tipo === 'ENTRADA' ? 'h-full rounded-full bg-green-600' : 'h-full rounded-full bg-red-600'}
                      style={{ width: `${percentual}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <h3 className="mb-2 text-sm font-semibold text-slate-900">Movimentações do período</h3>
        {centro.movimentacoes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma movimentação no período.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {centro.movimentacoes.map((mov) => (
              <li key={mov.id} className="flex items-center justify-between py-1.5">
                <div>
                  <p className="text-slate-900">{mov.categoria}</p>
                  <p className="text-xs text-slate-500">
                    {formatarDataBR(mov.data)} — {mov.descricao}
                  </p>
                </div>
                <span className={mov.tipo === 'ENTRADA' ? 'font-medium text-green-700' : 'font-medium text-red-700'}>
                  {mov.tipo === 'ENTRADA' ? '+' : '-'}
                  {formatarMoedaBR(mov.valor)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
