'use client'

import { useActionState } from 'react'
import { registrarDoacao } from './actions'

type Opcao = { id: string; nome: string }

export function NovaDoacaoForm({
  campanhaId,
  contas,
  formasPagamento,
  membros,
}: {
  campanhaId: string
  contas: Opcao[]
  formasPagamento: Opcao[]
  membros: Opcao[]
}) {
  const [state, formAction, pending] = useActionState(registrarDoacao, undefined)

  return (
    <form action={formAction} className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">Nova doação</h2>
      <input type="hidden" name="campanhaId" value={campanhaId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="doador" className="text-sm font-medium text-slate-700">
            Doador
          </label>
          <input
            id="doador"
            name="doador"
            type="text"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="membroId" className="text-sm font-medium text-slate-700">
            Membro (opcional, se o doador for membro da Loja)
          </label>
          <select
            id="membroId"
            name="membroId"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">-</option>
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="valor" className="text-sm font-medium text-slate-700">
            Valor
          </label>
          <input
            id="valor"
            name="valor"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="data" className="text-sm font-medium text-slate-700">
            Data
          </label>
          <input
            id="data"
            name="data"
            type="date"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="contaId" className="text-sm font-medium text-slate-700">
            Conta
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

        <div className="space-y-1 sm:col-span-2">
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
        disabled={pending}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Registrando...' : 'Registrar doação'}
      </button>
    </form>
  )
}
