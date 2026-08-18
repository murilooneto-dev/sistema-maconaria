import type { createSupabaseServerClient } from '@/lib/supabase/server'
import { calcularSaldoConta } from '@/lib/domain/financeiro'
import { formatarMoedaBR } from '@/lib/format'
import type { ResultadoRelatorio } from './tipos'

export async function buscarRelatorioSaldos(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<ResultadoRelatorio> {
  const { data: contas } = await supabase.from('contas').select('id, nome, saldo_inicial, ativo').order('nome')

  const linhas: string[][] = []
  let somaSaldo = 0

  for (const conta of contas ?? []) {
    const [entradas, saidas, transfSaida, transfEntrada] = await Promise.all([
      supabase.from('movimentacoes').select('valor').eq('conta_id', conta.id).eq('tipo', 'ENTRADA').eq('status', 'ATIVO'),
      supabase.from('movimentacoes').select('valor').eq('conta_id', conta.id).eq('tipo', 'SAIDA').eq('status', 'ATIVO'),
      supabase.from('transferencias').select('valor').eq('conta_origem_id', conta.id).eq('status', 'ATIVO'),
      supabase.from('transferencias').select('valor').eq('conta_destino_id', conta.id).eq('status', 'ATIVO'),
    ])

    const totalEntradas = (entradas.data ?? []).reduce((s, m) => s + Number(m.valor), 0)
    const totalSaidas = (saidas.data ?? []).reduce((s, m) => s + Number(m.valor), 0)
    const totalTransfSaida = (transfSaida.data ?? []).reduce((s, t) => s + Number(t.valor), 0)
    const totalTransfEntrada = (transfEntrada.data ?? []).reduce((s, t) => s + Number(t.valor), 0)

    const saldo = calcularSaldoConta({
      saldoInicial: Number(conta.saldo_inicial),
      totalEntradas,
      totalSaidas,
      totalTransferenciasSaida: totalTransfSaida,
      totalTransferenciasEntrada: totalTransfEntrada,
    })
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
