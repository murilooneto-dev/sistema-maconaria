'use client'

import { Fragment, useActionState, useMemo, useState, useTransition } from 'react'
import { marcarComoEnviado, marcarItensComoJaRepassados } from './actions'
import { abreviarMes } from '@/lib/format'

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
  return ordenados.map((i) => (anos.size > 1 ? `${abreviarMes(i.mes)}/${i.ano}` : abreviarMes(i.mes))).join(', ')
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

function DetalheMembro({ grupo }: { grupo: GrupoMembro }) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  const ordenados = [...grupo.itens].sort((a, b) => a.ano * 12 + a.mes - (b.ano * 12 + b.mes))

  function toggle(itemId: string) {
    setMarcados((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  function confirmar() {
    setErro(null)
    setSucesso(null)
    startTransition(async () => {
      const resultado = await marcarItensComoJaRepassados(Array.from(marcados))
      if (resultado.error) {
        setErro(resultado.error)
        return
      }
      setSucesso(`${marcados.size} mês(es) marcado(s) como já repassado(s).`)
      setMarcados(new Set())
    })
  }

  return (
    <div className="space-y-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-500">
        Marque os meses que já foram repassados à Grande Loja fora do sistema — eles saem do cálculo de repasse e não
        voltam sozinhos.
      </p>
      <ul className="space-y-1">
        {ordenados.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              id={`ja-repassado-${item.id}`}
              checked={marcados.has(item.id)}
              onChange={() => toggle(item.id)}
            />
            <label htmlFor={`ja-repassado-${item.id}`} className="cursor-pointer">
              {abreviarMes(item.mes)}/{item.ano} — R$ {item.valor.toFixed(2)}
            </label>
          </li>
        ))}
      </ul>

      {erro && (
        <p className="text-sm text-red-600" role="alert">
          {erro}
        </p>
      )}
      {sucesso && (
        <p className="text-sm text-green-700" role="status">
          {sucesso}
        </p>
      )}

      {marcados.size > 0 && (
        <button
          type="button"
          onClick={confirmar}
          disabled={pending}
          className="rounded border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
        >
          {pending ? 'Marcando...' : `Marcar ${marcados.size} mês(es) como já repassado(s)`}
        </button>
      )}
    </div>
  )
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
  const [expandido, setExpandido] = useState<string | null>(null)

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

      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white text-left text-slate-500">
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
              const aberto = expandido === grupo.membroId
              return (
                <Fragment key={grupo.membroId}>
                  <tr className="border-b border-slate-100 last:border-0">
                    <td className="px-2 py-1.5">
                      <input type="checkbox" checked={marcado} onChange={() => toggleGrupo(grupo)} />
                      {grupo.itens.map((item) => (
                        <input key={item.id} type="checkbox" name="itemId" value={item.id} checked={selecionados.has(item.id)} readOnly className="hidden" />
                      ))}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => setExpandido(aberto ? null : grupo.membroId)}
                        className="text-left font-medium text-slate-900 underline decoration-dotted hover:text-slate-600"
                      >
                        {grupo.membroNome}
                      </button>
                    </td>
                    <td className="px-2 py-1.5">{competenciasTexto(grupo.itens)}</td>
                    <td className="px-2 py-1.5">{valorTexto(grupo.itens)}</td>
                  </tr>
                  {aberto && (
                    <tr>
                      <td colSpan={4} className="p-0">
                        <DetalheMembro grupo={grupo} />
                      </td>
                    </tr>
                  )}
                </Fragment>
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
