'use client'

import { useActionState, useState } from 'react'
import { registrarMovimentacao, editarMovimentacao } from '../actions'

type Categoria = { id: string; nome: string; tipo: string }
type Opcao = { id: string; nome: string }

type ValoresIniciais = {
  data: string
  tipo: string
  categoriaId: string
  descricao: string
  valor: number
  contaId: string
  formaPagamentoId: string
  membroId: string
  observacao: string
}

export function NovaMovimentacaoForm({
  categorias,
  contas,
  formasPagamento,
  membros,
  modoEdicao,
}: {
  categorias: Categoria[]
  contas: Opcao[]
  formasPagamento: Opcao[]
  membros: Opcao[]
  modoEdicao?: { movimentacaoId: string; valoresIniciais: ValoresIniciais }
}) {
  const action = modoEdicao ? editarMovimentacao : registrarMovimentacao
  const [state, formAction, pending] = useActionState(action, undefined)
  const [tipo, setTipo] = useState(modoEdicao?.valoresIniciais.tipo ?? 'ENTRADA')

  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipo)

  return (
    <form action={formAction} className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">
        {modoEdicao ? 'Editar movimentação' : 'Nova movimentação'}
      </h2>

      {modoEdicao && <input type="hidden" name="movimentacaoId" value={modoEdicao.movimentacaoId} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="tipo" className="text-sm font-medium text-slate-700">
            Tipo
          </label>
          <select
            id="tipo"
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ENTRADA">Entrada</option>
            <option value="SAIDA">Saída</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="categoriaId" className="text-sm font-medium text-slate-700">
            Categoria
          </label>
          <select
            id="categoriaId"
            name="categoriaId"
            required
            defaultValue={modoEdicao?.valoresIniciais.categoriaId}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {categoriasDoTipo.length === 0 && <option value="">Nenhuma categoria disponível</option>}
            {categoriasDoTipo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="data" className="text-sm font-medium text-slate-700">
            Data
          </label>
          <input
            id="data"
            name="data"
            type="date"
            required
            defaultValue={modoEdicao?.valoresIniciais.data}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
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
            defaultValue={modoEdicao?.valoresIniciais.valor}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="contaId" className="text-sm font-medium text-slate-700">
            Conta
          </label>
          <select
            id="contaId"
            name="contaId"
            required
            defaultValue={modoEdicao?.valoresIniciais.contaId}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="formaPagamentoId" className="text-sm font-medium text-slate-700">
            Forma de pagamento
          </label>
          <select
            id="formaPagamentoId"
            name="formaPagamentoId"
            required
            defaultValue={modoEdicao?.valoresIniciais.formaPagamentoId}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {formasPagamento.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="membroId" className="text-sm font-medium text-slate-700">
            Membro (opcional)
          </label>
          <select
            id="membroId"
            name="membroId"
            defaultValue={modoEdicao?.valoresIniciais.membroId ?? ''}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">-</option>
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="descricao" className="text-sm font-medium text-slate-700">
            Descrição
          </label>
          <input
            id="descricao"
            name="descricao"
            type="text"
            defaultValue={modoEdicao?.valoresIniciais.descricao}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="observacao" className="text-sm font-medium text-slate-700">
            Observação
          </label>
          <textarea
            id="observacao"
            name="observacao"
            rows={2}
            defaultValue={modoEdicao?.valoresIniciais.observacao}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {modoEdicao && (
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="motivoEdicao" className="text-sm font-medium text-slate-700">
              Motivo da edição
            </label>
            <textarea
              id="motivoEdicao"
              name="motivoEdicao"
              rows={2}
              required
              placeholder="Ex.: valor lançado errado, deveria ser R$ 150,00"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="anexos" className="text-sm font-medium text-slate-700">
            Anexos (opcional)
          </label>
          <input
            id="anexos"
            name="anexos"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.csv,.xls,.xlsx"
            className="block w-full text-sm text-slate-700"
          />
        </div>
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
        {pending ? 'Salvando...' : modoEdicao ? 'Salvar edição' : 'Registrar'}
      </button>
    </form>
  )
}
