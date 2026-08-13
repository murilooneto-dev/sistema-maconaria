'use client'

import { useActionState, useMemo, useState } from 'react'
import { marcarComoEnviado } from './actions'

type Item = {
  id: string
  valor: number
  mensalidades:
    | { ano: number; mes: number; membro_id: string; membros: { nome: string }[] | { nome: string } | null }[]
    | { ano: number; mes: number; membro_id: string; membros: { nome: string }[] | { nome: string } | null }
    | null
}

type Opcao = { id: string; nome: string }

type GrupoMembro = {
  membroId: string
  membroNome: string
  itens: { id: string; ano: number; mes: number; valor: number }[]
}

function primeiraMensalidade(item: Item) {
  return Array.isArray(item.mensalidades) ? item.mensalidades[0] : item.mensalidades
}

function agruparPorMembro(itens: Item[]): GrupoMembro[] {
  const grupos = new Map<string, GrupoMembro>()

  for (const item of itens) {
    const m = primeiraMensalidade(item)
    if (!m) continue
    const membro = Array.isArray(m.membros) ? m.membros[0] : m.membros

    const grupo = grupos.get(m.membro_id) ?? {
      membroId: m.membro_id,
      membroNome: membro?.nome ?? '-',
      itens: [],
    }
    grupo.itens.push({ id: item.id, ano: m.ano, mes: m.mes, valor: Number(item.valor) })
    grupos.set(m.membro_id, grupo)
  }

  return Array.from(grupos.values()).sort((a, b) => a.membroNome.localeCompare(b.membroNome))
}

function competenciasTexto(itens: GrupoMembro['itens']): string {
  const ordenados = [...itens].sort((a, b) => a.ano * 12 + a.mes - (b.ano * 12 + b.mes))
  const anos = new Set(ordenados.map((i) => i.ano))
  return ordenados.map((i) => (anos.size > 1 ? `${String(i.mes).padStart(2, '0')}/${i.ano}` : String(i.mes).padStart(2, '0'))).join(', ')
}

function valorTexto(itens: GrupoMembro['itens']): string {
  const total = itens.reduce((s, i) => s + i.valor, 0)
  if (itens.length <= 1) {
    return `R$ ${total.toFixed(2)}`
  }
  const primeiro = itens[0].valor
  const uniforme = itens.every((i) => Math.abs(i.valor - primeiro) < 0.005)
  if (uniforme) {
    return `R$ ${total.toFixed(2)} (${itens.length}x R$ ${primeiro.toFixed(2)})`
  }
  return `R$ ${total.toFixed(2)}`
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
  const grupos = useMemo(() => agruparPorMembro(itens), [itens])
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  const totalSelecionado = itens
    .filter((i) => selecionados.has(i.id))
    .reduce((s, i) => s + Number(i.valor), 0)

  function toggleGrupo(grupo: GrupoMembro) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      const todosSelecionados = grupo.itens.every((i) => next.has(i.id))
      for (const item of grupo.itens) {
        if (todosSelecionados) next.delete(item.id)
        else next.add(item.id)
      }
      return next
    })
  }

  const totalItensSelecionados = selecionados.size

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">Itens pendentes</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="w-8 px-2 py-2"></th>
              <th className="px-2 py-2 font-medium">Membro</th>
              <th className="px-2 py-2 font-medium">Competências</th>
              <th className="px-2 py-2 font-medium">Valor GL</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((grupo) => {
              const marcado = grupo.itens.every((i) => selecionados.has(i.id))
              return (
                <tr key={grupo.membroId} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-1.5">
                    <input type="checkbox" checked={marcado} onChange={() => toggleGrupo(grupo)} />
                    {grupo.itens.map((item) => (
                      <input key={item.id} type="checkbox" name="itemId" value={item.id} checked={selecionados.has(item.id)} readOnly className="hidden" />
                    ))}
                  </td>
                  <td className="px-2 py-1.5">{grupo.membroNome}</td>
                  <td className="px-2 py-1.5">{competenciasTexto(grupo.itens)}</td>
                  <td className="px-2 py-1.5">{valorTexto(grupo.itens)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-sm font-medium text-slate-900">
        {totalItensSelecionados} item(ns) selecionado(s) — Total: R$ {totalSelecionado.toFixed(2)}
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
        disabled={pending || totalItensSelecionados === 0}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Enviando...' : `Marcar ${totalItensSelecionados} item(ns) como enviado`}
      </button>
    </form>
  )
}
