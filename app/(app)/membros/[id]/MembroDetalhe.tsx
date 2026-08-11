'use client'

import { useState, useTransition } from 'react'
import { atualizarMembro } from '../actions'

type Membro = {
  id: string
  nome: string
  telefone: string | null
  matricula: string
  do_quadro: boolean
  remido: boolean
  recolhe: boolean
  situacao: string
  data_cadastro: string
}

export function MembroDetalhe({ membro, isAdmin }: { membro: Membro; isAdmin: boolean }) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [nome, setNome] = useState(membro.nome)
  const [matricula, setMatricula] = useState(membro.matricula)
  const [telefone, setTelefone] = useState(membro.telefone ?? '')
  const [doQuadro, setDoQuadro] = useState(membro.do_quadro)
  const [remido, setRemido] = useState(membro.remido)
  const [recolhe, setRecolhe] = useState(membro.recolhe)
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null)

  function handleSave() {
    startTransition(async () => {
      const result = await atualizarMembro(membro.id, {
        nome,
        matricula,
        telefone,
        doQuadro,
        remido,
        recolhe,
      })
      setFeedback({ message: result.error ?? 'Membro atualizado.', isError: Boolean(result.error) })
      if (!result.error) {
        setEditing(false)
      }
    })
  }

  return (
    <div className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      {editing ? (
        <>
          <div className="space-y-1">
            <label htmlFor="nome" className="text-sm font-medium text-slate-700">
              Nome
            </label>
            <input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="matricula" className="text-sm font-medium text-slate-700">
              Matrícula
            </label>
            <input
              id="matricula"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="telefone" className="text-sm font-medium text-slate-700">
              Telefone
            </label>
            <input
              id="telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={doQuadro} onChange={(e) => setDoQuadro(e.target.checked)} />
              Do quadro
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={remido} onChange={(e) => setRemido(e.target.checked)} />
              Remido
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={recolhe} onChange={(e) => setRecolhe(e.target.checked)} />
              Recolhe
            </label>
          </div>
          <div className="space-x-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Matrícula</dt>
              <dd className="font-medium text-slate-900">{membro.matricula}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Telefone</dt>
              <dd className="font-medium text-slate-900">{membro.telefone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Do quadro</dt>
              <dd className="font-medium text-slate-900">{membro.do_quadro ? 'Sim' : 'Não'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Remido</dt>
              <dd className="font-medium text-slate-900">{membro.remido ? 'Sim' : 'Não'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Recolhe</dt>
              <dd className="font-medium text-slate-900">{membro.recolhe ? 'Sim' : 'Não'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Situação</dt>
              <dd
                className={
                  membro.situacao === 'ATIVO' ? 'font-medium text-green-700' : 'font-medium text-slate-400'
                }
              >
                {membro.situacao}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Cadastrado em</dt>
              <dd className="font-medium text-slate-900">
                {new Date(membro.data_cadastro).toLocaleDateString('pt-BR')}
              </dd>
            </div>
          </dl>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              Editar
            </button>
          )}
        </>
      )}

      {feedback && (
        <p
          className={`text-sm ${feedback.isError ? 'text-red-600' : 'text-green-700'}`}
          role={feedback.isError ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      )}
    </div>
  )
}
