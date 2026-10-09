import type { createSupabaseServerClient } from '@/lib/supabase/server'
import { calcularSaldoConta } from '@/lib/domain/financeiro'
import { formatarMoedaBR } from '@/lib/format'
import { buscarTodos } from '@/lib/supabase/buscar-todos'
import type { ResultadoRelatorio } from './tipos'

function somar(linhas: { valor: number }[] | null): number {
  return (linhas ?? []).reduce((s, l) => s + Number(l.valor), 0)
}

/** Totais de movimentações e transferências ATIVAS de uma conta, usados no cálculo do saldo (relatório e dashboard). */
export async function buscarTotaisDaConta(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  contaId: string
): Promise<{
  totalEntradas: number
  totalSaidas: number
  totalTransferenciasSaida: number
  totalTransferenciasEntrada: number
}> {
  const movimentacoes = (tipo: 'ENTRADA' | 'SAIDA') =>
    buscarTodos((de, ate) =>
      supabase
        .from('movimentacoes')
        .select('valor')
        .eq('conta_id', contaId)
        .eq('tipo', tipo)
        .eq('status', 'ATIVO')
        .order('id')
        .range(de, ate)
    )
  const transferencias = (coluna: 'conta_origem_id' | 'conta_destino_id') =>
    buscarTodos((de, ate) =>
      supabase.from('transferencias').select('valor').eq(coluna, contaId).eq('status', 'ATIVO').order('id').range(de, ate)
    )

  const [entradas, saidas, transfSaida, transfEntrada] = await Promise.all([
    movimentacoes('ENTRADA'),
    movimentacoes('SAIDA'),
    transferencias('conta_origem_id'),
    transferencias('conta_destino_id'),
  ])

  return {
    totalEntradas: somar(entradas.data),
    totalSaidas: somar(saidas.data),
    totalTransferenciasSaida: somar(transfSaida.data),
    totalTransferenciasEntrada: somar(transfEntrada.data),
  }
}

export async function buscarRelatorioSaldos(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<ResultadoRelatorio> {
  const { data: contas } = await supabase.from('contas').select('id, nome, saldo_inicial, ativo').order('nome')

  const linhas: string[][] = []
  let somaSaldo = 0

  for (const conta of contas ?? []) {
    const totais = await buscarTotaisDaConta(supabase, conta.id)
    const { totalEntradas, totalSaidas } = totais

    const saldo = calcularSaldoConta({ saldoInicial: Number(conta.saldo_inicial), ...totais })
    somaSaldo += saldo

    linhas.push([
      conta.nome,
      conta.ativo ? 'Ativa' : 'Inativa',
      formatarMoedaBR(Number(conta.saldo_inicial)),
      formatarMoedaBR(totalEntradas),
      formatarMoedaBR(totalSaidas),
      formatarMoedaBR(saldo),
    ])
  }

  return {
    titulo: 'Saldos por conta',
    resumo: [{ label: 'Saldo consolidado', valor: formatarMoedaBR(somaSaldo) }],
    colunas: ['Conta', 'Situação', 'Saldo inicial', 'Entradas', 'Saídas', 'Saldo atual'],
    linhas,
  }
}
