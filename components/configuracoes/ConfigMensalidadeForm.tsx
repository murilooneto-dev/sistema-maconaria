'use client'

import { useActionState } from 'react'
import { salvarConfigMensalidade } from '@/app/(app)/configuracoes/mensalidades/actions'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'

type ConfigHistorico = {
  id: string
  valor_mensalidade: number
  valor_grande_loja: number
  vigente_desde: string
}

export function ConfigMensalidadeForm({
  tipo,
  atual,
  historico,
}: {
  tipo: 'NORMAL' | 'REMIDO'
  atual: ConfigHistorico | null
  historico: ConfigHistorico[]
}) {
  const [state, formAction, pending] = useActionState(salvarConfigMensalidade, undefined)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Valor vigente</h2>
        {atual ? (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Valor da mensalidade</dt>
              <dd className="font-medium text-slate-900">
                {formatarMoedaBR(atual.valor_mensalidade)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Valor Grande Loja</dt>
              <dd className="font-medium text-slate-900">
                {formatarMoedaBR(atual.valor_grande_loja)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-slate-500">Nenhuma configuração cadastrada ainda.</p>
        )}
      </div>

      <form
        action={formAction}
        className="max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <h2 className="text-sm font-semibold text-slate-900">Nova configuração</h2>
        <p className="text-xs text-slate-500">
          Cadastrar uma nova configuração não altera competências já geradas — vale apenas para as
          próximas.
        </p>

        <input type="hidden" name="tipo" value={tipo} />

        <div className="space-y-1">
          <label htmlFor={`valorMensalidade-${tipo}`} className="text-sm font-medium text-slate-700">
            Valor da mensalidade (R$)
          </label>
          <input
            id={`valorMensalidade-${tipo}`}
            name="valorMensalidade"
            type="number"
            step="0.01"
            min="0"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={`valorGrandeLoja-${tipo}`} className="text-sm font-medium text-slate-700">
            Valor Grande Loja (R$)
          </label>
          <input
            id={`valorGrandeLoja-${tipo}`}
            name="valorGrandeLoja"
            type="number"
            step="0.01"
            min="0"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
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
          {pending ? 'Salvando...' : 'Salvar nova configuração'}
        </button>
      </form>

      {historico.length > 0 && (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Vigente desde</th>
                <th className="px-4 py-2 font-medium">Mensalidade</th>
                <th className="px-4 py-2 font-medium">Grande Loja</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-slate-500">
                    {formatarDataBR(item.vigente_desde.split('T')[0])}
                  </td>
                  <td className="px-4 py-2">
                    {formatarMoedaBR(item.valor_mensalidade)}
                  </td>
                  <td className="px-4 py-2">
                    {formatarMoedaBR(item.valor_grande_loja)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
