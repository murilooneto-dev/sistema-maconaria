'use client'

import { useActionState } from 'react'
import { registrarPagamento } from './actions'

type Competencia = {
  id: string
  ano: number
  mes: number
  valor_devido: number
  valor_pago: number
  saldo: number
  status: string
}

export function PagamentoForm({
  membroId,
  competencias,
  contas,
  formasPagamento,
}: {
  membroId: string
  competencias: Competencia[]
  contas: { id: string; nome: string }[]
  formasPagamento: { id: string; nome: string }[]
}) {
  const [state, formAction, pending] = useActionState(registrarPagamento, undefined)

  if (competencias.length === 0) {
    return <p className="text-sm text-slate-500">Este membro não possui competências pendentes.</p>
  }

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <input type="hidden" name="membroId" value={membroId} />

      <table className="w-full text-sm">
        <thead className="text-left text-slate-500">
          <tr>
            <th className="py-2"></th>
            <th className="py-2">Competência</th>
            <th className="py-2">Devido</th>
            <th className="py-2">Saldo</th>
            <th className="py-2">Valor a aplicar</th>
          </tr>
        </thead>
        <tbody>
          {competencias.map((c) => (
            <tr key={c.id} className="border-t border-slate-100">
              <td className="py-2">
                <input type="checkbox" name={`selecionada_${c.id}`} />
                <input type="hidden" name="mensalidadeId" value={c.id} />
              </td>
              <td className="py-2">
                {String(c.mes).padStart(2, '0')}/{c.ano}
              </td>
              <td className="py-2">
                {c.valor_devido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
              <td className="py-2">{c.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              <td className="py-2">
                <input
                  type="number"
                  step="0.01"
                  name={`valorAplicado_${c.id}`}
                  defaultValue={c.saldo}
                  className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="dataPagamento" className="text-sm font-medium text-slate-700">
            Data do pagamento
          </label>
          <input
            id="dataPagamento"
            name="dataPagamento"
            type="date"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="contaId" className="text-sm font-medium text-slate-700">
            Conta
          </label>
          <select id="contaId" name="contaId" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
            <option value="">Selecione</option>
            {contas.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.nome}
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
            <option value="">Selecione</option>
            {formasPagamento.map((forma) => (
              <option key={forma.id} value={forma.id}>
                {forma.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="observacao" className="text-sm font-medium text-slate-700">
          Observação (opcional)
        </label>
        <input
          id="observacao"
          name="observacao"
          type="text"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="anexos" className="text-sm font-medium text-slate-700">
          Anexos (opcional)
        </label>
        <input
          id="anexos"
          name="anexos"
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.csv,.xls,.xlsx"
          className="block w-full text-sm text-slate-700"
        />
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
        disabled={pending}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Registrando...' : 'Confirmar pagamento'}
      </button>
    </form>
  )
}
