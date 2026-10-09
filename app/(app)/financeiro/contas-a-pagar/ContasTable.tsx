'use client'

import { Fragment, useActionState, useEffect, useState, useTransition } from 'react'
import { baixarConta, cancelarConta, estornarBaixa } from './actions'
import { contaVencida, tipoMovimentacaoDaConta, type TipoConta } from '@/lib/domain/contas-pagar-receber'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'

export type ContaPagarReceber = {
  id: string
  tipo: TipoConta
  nome: string
  valor: number
  data_vencimento: string
  observacao: string | null
  recorrencia_id: string | null
  parcela: number | null
  total_parcelas: number | null
  status: string
  data_baixa: string | null
  valor_baixa: number | null
  motivo_cancelamento: string | null
}

type Opcao = { id: string; nome: string }
type Categoria = { id: string; nome: string; tipo: string }

function Situacao({ conta, hoje }: { conta: ContaPagarReceber; hoje: string }) {
  if (conta.status === 'BAIXADA') {
    return (
      <span className="text-green-700">
        {conta.tipo === 'PAGAR' ? 'Paga' : 'Recebida'}
        {conta.data_baixa && ` em ${formatarDataBR(conta.data_baixa)}`}
      </span>
    )
  }
  if (conta.status === 'CANCELADA') {
    return (
      <span className="text-slate-400" title={conta.motivo_cancelamento ?? ''}>
        Cancelada
      </span>
    )
  }
  if (contaVencida(conta, hoje)) {
    return <span className="font-medium text-red-700">Vencida</span>
  }
  if (conta.data_vencimento === hoje) {
    return <span className="font-medium text-amber-700">Vence hoje</span>
  }
  return <span className="text-slate-700">Em aberto</span>
}

function BaixaForm({
  conta,
  hoje,
  contas,
  formasPagamento,
  categorias,
  onConcluida,
  onCancelar,
}: {
  conta: ContaPagarReceber
  hoje: string
  contas: Opcao[]
  formasPagamento: Opcao[]
  categorias: Categoria[]
  onConcluida: (mensagem: string) => void
  onCancelar: () => void
}) {
  const [state, formAction, pending] = useActionState(baixarConta, undefined)
  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipoMovimentacaoDaConta(conta.tipo))

  useEffect(() => {
    if (state && 'success' in state) {
      onConcluida(state.success)
    }
  }, [state, onConcluida])

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="contaPagarReceberId" value={conta.id} />
      <p className="text-xs text-slate-500">
        A baixa cria uma {conta.tipo === 'PAGAR' ? 'saída' : 'entrada'} no Financeiro com os dados abaixo.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <label htmlFor={`dataBaixa-${conta.id}`} className="text-xs font-medium text-slate-600">
            Data {conta.tipo === 'PAGAR' ? 'do pagamento' : 'do recebimento'}
          </label>
          <input
            id={`dataBaixa-${conta.id}`}
            name="dataBaixa"
            type="date"
            required
            defaultValue={hoje}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`valorBaixa-${conta.id}`} className="text-xs font-medium text-slate-600">
            Valor {conta.tipo === 'PAGAR' ? 'pago' : 'recebido'}
          </label>
          <input
            id={`valorBaixa-${conta.id}`}
            name="valorBaixa"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={conta.valor}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`contaId-${conta.id}`} className="text-xs font-medium text-slate-600">
            Conta bancária
          </label>
          <select
            id={`contaId-${conta.id}`}
            name="contaId"
            required
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">Selecione</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`forma-${conta.id}`} className="text-xs font-medium text-slate-600">
            Forma de pagamento
          </label>
          <select
            id={`forma-${conta.id}`}
            name="formaPagamentoId"
            required
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">Selecione</option>
            {formasPagamento.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`categoria-${conta.id}`} className="text-xs font-medium text-slate-600">
            Categoria
          </label>
          <select
            id={`categoria-${conta.id}`}
            name="categoriaId"
            required
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">Selecione</option>
            {categoriasDoTipo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state && 'error' in state && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="space-x-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Registrando...' : 'Confirmar baixa'}
        </button>
        <button type="button" onClick={onCancelar} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700">
          Fechar
        </button>
      </div>
    </form>
  )
}

export function ContasTable({
  contasPagarReceber,
  hoje,
  podeEditar,
  contas,
  formasPagamento,
  categorias,
}: {
  contasPagarReceber: ContaPagarReceber[]
  hoje: string
  podeEditar: boolean
  contas: Opcao[]
  formasPagamento: Opcao[]
  categorias: Categoria[]
}) {
  const [baixando, setBaixando] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null)

  function handleCancelar(conta: ContaPagarReceber, incluirProximas: boolean) {
    const motivo = window.prompt(
      incluirProximas
        ? `Cancelar "${conta.nome}" a partir da parcela ${conta.parcela}/${conta.total_parcelas} (esta e as seguintes em aberto). Motivo:`
        : `Motivo do cancelamento de "${conta.nome}" (vencimento ${formatarDataBR(conta.data_vencimento)}):`
    )
    if (motivo === null) return
    if (motivo.trim().length === 0) {
      setFeedback({ message: 'Informe o motivo do cancelamento.', isError: true })
      return
    }
    startTransition(async () => {
      const result = await cancelarConta(conta.id, motivo, incluirProximas)
      setFeedback({
        message: result.error ?? `${result.canceladas} conta(s) cancelada(s).`,
        isError: Boolean(result.error),
      })
    })
  }

  function handleEstornar(conta: ContaPagarReceber) {
    const motivo = window.prompt(
      `Estornar a baixa de "${conta.nome}"? O lançamento no Financeiro é cancelado e a conta volta a ficar em aberto. Motivo:`
    )
    if (motivo === null) return
    if (motivo.trim().length === 0) {
      setFeedback({ message: 'Informe o motivo do estorno.', isError: true })
      return
    }
    startTransition(async () => {
      const result = await estornarBaixa(conta.id, motivo)
      setFeedback({ message: result.error ?? 'Baixa estornada.', isError: Boolean(result.error) })
    })
  }

  if (contasPagarReceber.length === 0) {
    return <p className="text-sm text-slate-500">Nenhuma conta encontrada para este filtro.</p>
  }

  const colunas = podeEditar ? 6 : 5

  return (
    <div className="space-y-2">
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Vencimento</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Conta</th>
              <th className="px-4 py-2 font-medium">Valor</th>
              <th className="px-4 py-2 font-medium">Situação</th>
              {podeEditar && <th className="px-4 py-2 font-medium">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {contasPagarReceber.map((conta) => (
              <Fragment key={conta.id}>
                <tr className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">{formatarDataBR(conta.data_vencimento)}</td>
                  <td className="px-4 py-2">
                    <span className={conta.tipo === 'PAGAR' ? 'text-red-700' : 'text-green-700'}>
                      {conta.tipo === 'PAGAR' ? 'A pagar' : 'A receber'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-medium text-slate-900">{conta.nome}</span>
                    {conta.parcela && (
                      <span className="ml-1 text-xs text-slate-500">
                        ({conta.parcela}/{conta.total_parcelas})
                      </span>
                    )}
                    {conta.observacao && <p className="text-xs text-slate-500">{conta.observacao}</p>}
                  </td>
                  <td className="px-4 py-2">
                    {formatarMoedaBR(Number(conta.valor))}
                    {conta.status === 'BAIXADA' && Number(conta.valor_baixa) !== Number(conta.valor) && (
                      <p className="text-xs text-slate-500">baixado: {formatarMoedaBR(Number(conta.valor_baixa))}</p>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Situacao conta={conta} hoje={hoje} />
                  </td>
                  {podeEditar && (
                    <td className="space-x-3 px-4 py-2">
                      {conta.status === 'ABERTA' && (
                        <>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => setBaixando(baixando === conta.id ? null : conta.id)}
                            className="font-medium text-slate-900 underline disabled:opacity-50"
                          >
                            Dar baixa
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleCancelar(conta, false)}
                            className="text-slate-700 underline disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                          {conta.recorrencia_id && conta.parcela !== conta.total_parcelas && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleCancelar(conta, true)}
                              className="text-slate-700 underline disabled:opacity-50"
                            >
                              Cancelar esta e as próximas
                            </button>
                          )}
                        </>
                      )}
                      {conta.status === 'BAIXADA' && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleEstornar(conta)}
                          className="text-slate-700 underline disabled:opacity-50"
                        >
                          Estornar baixa
                        </button>
                      )}
                    </td>
                  )}
                </tr>
                {baixando === conta.id && conta.status === 'ABERTA' && (
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <td colSpan={colunas} className="px-4 py-3">
                      <BaixaForm
                        conta={conta}
                        hoje={hoje}
                        contas={contas}
                        formasPagamento={formasPagamento}
                        categorias={categorias}
                        onConcluida={(mensagem) => {
                          setBaixando(null)
                          setFeedback({ message: mensagem, isError: false })
                        }}
                        onCancelar={() => setBaixando(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

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
