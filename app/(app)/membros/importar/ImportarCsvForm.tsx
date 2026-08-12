'use client'

import { useActionState } from 'react'
import { importarMembros } from './actions'

export function ImportarCsvForm() {
  const [state, formAction, pending] = useActionState(importarMembros, undefined)

  return (
    <div className="max-w-2xl space-y-4">
      <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div className="space-y-1">
          <label htmlFor="arquivo" className="text-sm font-medium text-slate-700">
            Arquivo CSV
          </label>
          <input
            id="arquivo"
            name="arquivo"
            type="file"
            accept=".csv,text/csv"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Importando...' : 'Importar'}
        </button>
      </form>

      {state?.resumo && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-6 text-sm">
          <p className="font-medium text-slate-900">
            {state.resumo.criados} de {state.resumo.total} membro(s) criado(s) com sucesso.
          </p>

          {state.resumo.duplicados.length > 0 && (
            <div>
              <p className="font-medium text-amber-700">Matrículas já existentes (ignoradas):</p>
              <ul className="list-inside list-disc text-slate-600">
                {state.resumo.duplicados.map((d) => (
                  <li key={d.linha}>
                    Linha {d.linha}: matrícula {d.matricula}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.resumo.invalidos.length > 0 && (
            <div>
              <p className="font-medium text-red-700">Linhas inválidas (não importadas):</p>
              <ul className="list-inside list-disc text-slate-600">
                {state.resumo.invalidos.map((e) => (
                  <li key={e.linha}>
                    Linha {e.linha}: {e.erro}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.resumo.falhas.length > 0 && (
            <div>
              <p className="font-medium text-red-700">Falhas ao gravar:</p>
              <ul className="list-inside list-disc text-slate-600">
                {state.resumo.falhas.map((f) => (
                  <li key={f.linha}>
                    Linha {f.linha}: {f.erro}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
