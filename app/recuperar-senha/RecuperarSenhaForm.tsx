'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { solicitarRecuperacaoSenha } from './actions'

export function RecuperarSenhaForm({ linkInvalido }: { linkInvalido: boolean }) {
  const [state, formAction, pending] = useActionState(solicitarRecuperacaoSenha, undefined)
  const enviado = Boolean(state && 'success' in state)

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Recuperar senha</h1>
          <p className="text-sm text-slate-500">
            Informe o e-mail do seu acesso. Enviaremos um link para definir uma nova senha.
          </p>
        </div>

        {linkInvalido && !state && (
          <p className="text-sm text-red-600" role="alert">
            O link de recuperação é inválido ou expirou. Solicite um novo.
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={enviado}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
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

        {!enviado && (
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? 'Enviando...' : 'Enviar link'}
          </button>
        )}

        <p className="text-center text-sm">
          <Link href="/login" className="text-slate-600 underline">
            Voltar para o login
          </Link>
        </p>
      </form>
    </div>
  )
}
