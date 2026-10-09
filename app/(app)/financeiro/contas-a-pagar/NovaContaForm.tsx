'use client'

import { useActionState, useState } from 'react'
import { criarConta } from './actions'
import { MAX_MESES_RECORRENCIA } from '@/lib/domain/contas-pagar-receber'

export function NovaContaForm({ nomesJaUsados }: { nomesJaUsados: string[] }) {
  const [state, formAction, pending] = useActionState(criarConta, undefined)
  const [recorrente, setRecorrente] = useState(false)

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">Nova conta</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label htmlFor="tipo" className="text-sm font-medium text-slate-700">
            Tipo
          </label>
          <select
            id="tipo"
            name="tipo"
            required
            defaultValue="PAGAR"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="PAGAR">A pagar</option>
            <option value="RECEBER">A receber</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="nome" className="text-sm font-medium text-slate-700">
            Conta
          </label>
          <input
            id="nome"
            name="nome"
            type="text"
            list="contas-ja-usadas"
            autoComplete="off"
            required
            placeholder="Ex.: Energia, Aluguel"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <datalist id="contas-ja-usadas">
            {nomesJaUsados.map((nome) => (
              <option key={nome} value={nome} />
            ))}
          </datalist>
          <p className="text-xs text-slate-500">Escolha uma já usada ou digite uma nova.</p>
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
          <label htmlFor="dataVencimento" className="text-sm font-medium text-slate-700">
            {recorrente ? 'Primeiro vencimento' : 'Vencimento'}
          </label>
          <input
            id="dataVencimento"
            name="dataVencimento"
            type="date"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="recorrente"
            checked={recorrente}
            onChange={(e) => setRecorrente(e.target.checked)}
          />
          Recorrente (repete todo mês)
        </label>

        {recorrente && (
          <div className="space-y-1">
            <label htmlFor="meses" className="block text-sm font-medium text-slate-700">
              Por quantos meses
            </label>
            <input
              id="meses"
              name="meses"
              type="number"
              min={2}
              max={MAX_MESES_RECORRENCIA}
              step={1}
              required
              defaultValue={12}
              className="w-32 rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="min-w-[14rem] flex-1 space-y-1">
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
      </div>

      {recorrente && (
        <p className="text-xs text-slate-500">
          O sistema cria uma conta por mês, com o mesmo valor e o mesmo dia de vencimento, a partir da data informada.
        </p>
      )}

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
        {pending ? 'Criando...' : 'Criar conta'}
      </button>
    </form>
  )
}
