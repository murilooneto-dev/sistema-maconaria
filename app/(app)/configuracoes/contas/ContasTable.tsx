'use client'

import { useState, useTransition } from 'react'
import { atualizarConta } from './actions'

type Conta = {
  id: string
  nome: string
  descricao: string | null
  saldo_inicial: number
  data_saldo_inicial: string
  ativo: boolean
}

export function ContasTable({ contas }: { contas: Conta[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ id: string; message: string; isError: boolean } | null>(
    null
  )

  function handleToggleAtivo(conta: Conta) {
    const confirmMessage = conta.ativo
      ? `Desativar a conta ${conta.nome}?`
      : `Reativar a conta ${conta.nome}?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    startTransition(async () => {
      const result = await atualizarConta(conta.id, {
        nome: conta.nome,
        descricao: conta.descricao ?? '',
        saldoInicial: conta.saldo_inicial,
        dataSaldoInicial: conta.data_saldo_inicial,
        ativo: !conta.ativo,
      })
      setFeedback({
        id: conta.id,
        message: result.error ?? 'Status atualizado.',
        isError: Boolean(result.error),
      })
    })
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Nome</th>
            <th className="px-4 py-2 font-medium">Saldo inicial</th>
            <th className="px-4 py-2 font-medium">Data do saldo</th>
            <th className="px-4 py-2 font-medium">Situação</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {contas.map((conta) => (
            <tr key={conta.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2">
                {editingId === conta.id ? (
                  <EditForm
                    conta={conta}
                    pending={isPending}
                    onCancel={() => setEditingId(null)}
                    onSave={(dados) => {
                      startTransition(async () => {
                        const result = await atualizarConta(conta.id, dados)
                        setFeedback({
                          id: conta.id,
                          message: result.error ?? 'Conta atualizada.',
                          isError: Boolean(result.error),
                        })
                        if (!result.error) {
                          setEditingId(null)
                        }
                      })
                    }}
                  />
                ) : (
                  <>
                    <div className="font-medium text-slate-900">{conta.nome}</div>
                    {conta.descricao && <div className="text-xs text-slate-500">{conta.descricao}</div>}
                  </>
                )}
              </td>
              <td className="px-4 py-2">
                {editingId === conta.id
                  ? '—'
                  : conta.saldo_inicial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
              <td className="px-4 py-2">
                {editingId === conta.id ? '—' : new Date(conta.data_saldo_inicial).toLocaleDateString('pt-BR')}
              </td>
              <td className="px-4 py-2">
                <span className={conta.ativo ? 'text-green-700' : 'text-slate-400'}>
                  {conta.ativo ? 'Ativa' : 'Inativa'}
                </span>
              </td>
              <td className="space-x-2 px-4 py-2">
                {editingId !== conta.id && (
                  <button
                    type="button"
                    onClick={() => setEditingId(conta.id)}
                    className="text-slate-700 underline"
                  >
                    Editar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleToggleAtivo(conta)}
                  disabled={isPending}
                  className="text-slate-700 underline disabled:opacity-50"
                >
                  {conta.ativo ? 'Desativar' : 'Reativar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {feedback && (
        <p
          className={`px-4 py-2 text-sm ${feedback.isError ? 'text-red-600' : 'text-green-700'}`}
          role={feedback.isError ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      )}
    </div>
  )
}

function EditForm({
  conta,
  pending,
  onSave,
  onCancel,
}: {
  conta: Conta
  pending: boolean
  onSave: (dados: {
    nome: string
    descricao: string
    saldoInicial: number
    dataSaldoInicial: string
    ativo: boolean
  }) => void
  onCancel: () => void
}) {
  const [nome, setNome] = useState(conta.nome)
  const [descricao, setDescricao] = useState(conta.descricao ?? '')
  const [saldoInicial, setSaldoInicial] = useState(String(conta.saldo_inicial))
  const [dataSaldoInicial, setDataSaldoInicial] = useState(conta.data_saldo_inicial)

  return (
    <div className="space-y-2">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome"
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <input
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Descrição"
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <input
        type="number"
        step="0.01"
        value={saldoInicial}
        onChange={(e) => setSaldoInicial(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <input
        type="date"
        value={dataSaldoInicial}
        onChange={(e) => setDataSaldoInicial(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <div className="space-x-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            onSave({
              nome,
              descricao,
              saldoInicial: Number(saldoInicial),
              dataSaldoInicial,
              ativo: conta.ativo,
            })
          }
          className="text-sm text-slate-900 underline disabled:opacity-50"
        >
          Salvar
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 underline">
          Cancelar
        </button>
      </div>
    </div>
  )
}
