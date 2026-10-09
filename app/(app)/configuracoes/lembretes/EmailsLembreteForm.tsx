'use client'

import { useActionState } from 'react'
import { salvarEmailsLembrete } from './actions'

export function EmailsLembreteForm({ emails }: { emails: string[] }) {
  const [state, formAction, pending] = useActionState(salvarEmailsLembrete, undefined)

  return (
    <form action={formAction} className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-900">Lembrete de contas a pagar e a receber</h2>
        <p className="text-sm text-slate-500">
          Todo dia às 8h o sistema envia um e-mail com as contas que vencem hoje e em 3 dias, e as já vencidas.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="emails" className="text-sm font-medium text-slate-700">
          E-mails que recebem o aviso
        </label>
        <textarea
          id="emails"
          name="emails"
          rows={4}
          defaultValue={emails.join('\n')}
          placeholder={'tesouraria@exemplo.com\noutro@exemplo.com'}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="text-xs text-slate-500">
          Um por linha (até 10). Se deixar em branco, o aviso vai para os Administradores e Tesoureiros que tenham
          e-mail cadastrado em Usuários.
        </p>
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
        {pending ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}
