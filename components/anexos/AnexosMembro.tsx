'use client'

import { useRef, useState, useTransition } from 'react'
import { enviarAnexosMembro } from '@/app/(app)/anexos/actions'
import { AnexosList, type AnexoItem } from './AnexosList'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.csv,.xls,.xlsx'

export function AnexosMembro({
  membroId,
  anexos,
  podeGerenciar,
}: {
  membroId: string
  anexos: AnexoItem[]
  podeGerenciar: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const resultado = await enviarAnexosMembro(membroId, formData)
      setFeedback({ message: resultado.error ?? resultado.success ?? '', isError: Boolean(resultado.error) })
      if (!resultado.error) {
        formRef.current?.reset()
      }
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">Anexos</h2>

      <AnexosList anexos={anexos} podeExcluir={podeGerenciar} />

      {podeGerenciar && (
        <form ref={formRef} action={handleSubmit} className="space-y-2 border-t border-slate-100 pt-3">
          <input
            type="file"
            name="arquivos"
            multiple
            accept={ACCEPT}
            className="block w-full text-sm text-slate-700"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? 'Enviando...' : 'Enviar arquivo(s)'}
          </button>
          {feedback && (
            <p className={`text-sm ${feedback.isError ? 'text-red-600' : 'text-green-700'}`}>
              {feedback.message}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
