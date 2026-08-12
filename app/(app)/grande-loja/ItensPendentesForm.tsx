'use client'

import { useActionState, useState } from 'react'
import { marcarComoEnviado } from './actions'

type Item = {
  id: string
  valor: number
  mensalidades: { ano: number; mes: number; membros: { nome: string }[] | { nome: string } | null }[] | { ano: number; mes: number; membros: { nome: string }[] | { nome: string } | null } | null
}

type Opcao = { id: string; nome: string }

function membroDoItem(item: Item): string {
  const m = Array.isArray(item.mensalidades) ? item.mensalidades[0] : item.mensalidades
  if (!m) return '-'
  const membro = Array.isArray(m.membros) ? m.membros[0] : m.membros
  return membro?.nome ?? '-'
}

function competenciaDoItem(item: Item): string {
  const m = Array.isArray(item.mensalidades) ? item.mensalidades[0] : item.mensalidades
  if (!m) return '-'
  return `${String(m.mes).padStart(2, '0')}/${m.ano}`
}

export function ItensPendentesForm({
  itens,
  contas,
  formasPagamento,
}: {
  itens: Item[]
  contas: Opcao[]
  formasPagamento: Opcao[]
}) {
  const [state, formAction, pending] = useActionState(marcarComoEnviado, undefined)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(itens.map((i) => i.id)))

  const totalSelecionado = itens
    .filter((i) => selecionados.has(i.id))
    .reduce((s, i) => s + Number(i.valor), 0)

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">Itens pendentes</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="w-8 px-2 py-2"></th>
              <th className="px-2 py-2 font-medium">Membro</th>
              <th className="px-2 py-2 font-medium">Competência</th>
              <th className="px-2 py-2 font-medium">Valor GL</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-1.5">
                  <input
                    type="checkbox"
                    name="itemId"
                    value={item.id}
                    checked={selecionados.has(item.id)}
                    onChange={() => toggle(item.id)}
                  />
                </td>
                <td className="px-2 py-1.5">{membroDoItem(item)}</td>
                <td className="px-2 py-1.5">{competenciaDoItem(item)}</td>
                <td className="px-2 py-1.5">R$ {Number(item.valor).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm font-medium text-slate-900">
        Total selecionado: R$ {totalSelecionado.toFixed(2)}
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="dataEnvio" className="text-sm font-medium text-slate-700">
            Data do envio
          </label>
          <input
            id="dataEnvio"
            name="dataEnvio"
            type="date"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="contaId" className="text-sm font-medium text-slate-700">
            Conta de origem
          </label>
          <select
            id="contaId"
            name="contaId"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="formaPagamentoId" className="text-sm font-medium text-slate-700">
            Forma de pagamento
          </label>
          <select
            id="formaPagamentoId"
            name="formaPagamentoId"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {formasPagamento.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-3">
          <label htmlFor="observacao" className="text-sm font-medium text-slate-700">
            Observação
          </label>
          <textarea
            id="observacao"
            name="observacao"
            rows={2}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {state && 'error' in state && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state && 'success' in state && (
        <p className="text-sm text-green-700" role="status">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || selecionados.size === 0}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Enviando...' : `Marcar ${selecionados.size} item(ns) como enviado`}
      </button>
    </form>
  )
}
