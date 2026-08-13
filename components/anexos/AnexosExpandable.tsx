'use client'

import { useState } from 'react'
import { AnexosList, type AnexoItem } from './AnexosList'

export function AnexosExpandable({ anexos, podeExcluir }: { anexos: AnexoItem[]; podeExcluir: boolean }) {
  const [aberto, setAberto] = useState(false)

  if (anexos.length === 0) {
    return <span className="text-xs text-slate-400">—</span>
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="text-xs text-slate-700 underline"
      >
        {anexos.length} anexo{anexos.length > 1 ? 's' : ''}
      </button>
      {aberto && (
        <div className="mt-2 max-w-xs">
          <AnexosList anexos={anexos} podeExcluir={podeExcluir} />
        </div>
      )}
    </div>
  )
}
