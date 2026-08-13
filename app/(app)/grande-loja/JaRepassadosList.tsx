'use client'

import { useState, useTransition } from 'react'
import { reverterItemJaRepassado } from './actions'
import { abreviarMes } from '@/lib/format'

type Item = {
  id: string
  valor: number
  cancelado_em: string | null
  mensalidades:
    | { ano: number; mes: number; membros: { nome: string }[] | { nome: string } | null }[]
    | { ano: number; mes: number; membros: { nome: string }[] | { nome: string } | null }
    | null
}

function primeiraMensalidade(item: Item) {
  return Array.isArray(item.mensalidades) ? item.mensalidades[0] : item.mensalidades
}

export function JaRepassadosList({ itens }: { itens: Item[] }) {
  const [pending, startTransition] = useTransition()
  const [itemPendente, setItemPendente] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  function reverter(itemId: string) {
    setErro(null)
    setItemPendente(itemId)
    startTransition(async () => {
      const resultado = await reverterItemJaRepassado(itemId)
      setItemPendente(null)
      if (resultado.error) setErro(resultado.error)
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">Itens marcados como já repassados</h2>
      <p className="text-xs text-slate-500">
        Competências excluídas manualmente do cálculo de repasse por já terem sido repassadas à Grande Loja fora do
        sistema. Reverter faz o item voltar a compor o cálculo.
      </p>

      {erro && (
        <p className="text-sm text-red-600" role="alert">
          {erro}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-2 py-2 font-medium">Membro</th>
              <th className="px-2 py-2 font-medium">Competência</th>
              <th className="px-2 py-2 font-medium">Valor GL</th>
              <th className="px-2 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => {
              const m = primeiraMensalidade(item)
              const membro = m && (Array.isArray(m.membros) ? m.membros[0] : m.membros)
              return (
                <tr key={item.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-1.5">{membro?.nome ?? '-'}</td>
                  <td className="px-2 py-1.5">{m ? `${abreviarMes(m.mes)}/${m.ano}` : '-'}</td>
                  <td className="px-2 py-1.5">R$ {Number(item.valor).toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => reverter(item.id)}
                      disabled={pending && itemPendente === item.id}
                      className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                      {pending && itemPendente === item.id ? 'Revertendo...' : 'Reverter'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
