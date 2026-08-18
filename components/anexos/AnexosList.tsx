'use client'

import { useState, useTransition } from 'react'
import { obterUrlAnexo, excluirAnexo } from '@/app/(app)/anexos/actions'
import { formatarDataBR } from '@/lib/format'

export type AnexoItem = {
  id: string
  nome_arquivo: string
  tamanho_bytes: number
  criado_em: string
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AnexosList({ anexos, podeExcluir }: { anexos: AnexoItem[]; podeExcluir: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ id: string; message: string; isError: boolean } | null>(null)
  const [removidos, setRemovidos] = useState<Set<string>>(new Set())

  function handleBaixar(anexo: AnexoItem) {
    startTransition(async () => {
      const resultado = await obterUrlAnexo(anexo.id)
      if (resultado.error || !resultado.url) {
        setFeedback({ id: anexo.id, message: resultado.error ?? 'Falha ao gerar link.', isError: true })
        return
      }
      window.open(resultado.url, '_blank', 'noopener,noreferrer')
    })
  }

  function handleExcluir(anexo: AnexoItem) {
    if (!window.confirm(`Excluir o anexo "${anexo.nome_arquivo}"?`)) {
      return
    }
    startTransition(async () => {
      const resultado = await excluirAnexo(anexo.id)
      if (resultado.error) {
        setFeedback({ id: anexo.id, message: resultado.error, isError: true })
        return
      }
      setRemovidos((prev) => new Set(prev).add(anexo.id))
    })
  }

  const visiveis = anexos.filter((a) => !removidos.has(a.id))

  if (visiveis.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum anexo.</p>
  }

  return (
    <ul className="space-y-1">
      {visiveis.map((anexo) => (
        <li key={anexo.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-slate-700">
            {anexo.nome_arquivo}{' '}
            <span className="text-xs text-slate-400">
              ({formatarTamanho(anexo.tamanho_bytes)} · {formatarDataBR(anexo.criado_em.split('T')[0])})
            </span>
          </span>
          <span className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleBaixar(anexo)}
              className="text-slate-700 underline disabled:opacity-50"
            >
              Baixar
            </button>
            {podeExcluir && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleExcluir(anexo)}
                className="text-red-600 underline disabled:opacity-50"
              >
                Excluir
              </button>
            )}
          </span>
          {feedback?.id === anexo.id && (
            <p className={`w-full text-xs ${feedback.isError ? 'text-red-600' : 'text-green-700'}`}>
              {feedback.message}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
