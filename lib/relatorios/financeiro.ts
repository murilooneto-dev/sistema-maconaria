import type { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'
import { buscarTodos } from '@/lib/supabase/buscar-todos'
import type { ResultadoRelatorio } from './tipos'

export type FiltrosFinanceiro = {
  dataInicio?: string
  dataFim?: string
  tipo?: string
  categoriaId?: string
  contaId?: string
  formaPagamentoId?: string
  membroId?: string
  campanhaId?: string
}

export async function buscarRelatorioFinanceiro(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filtros: FiltrosFinanceiro
): Promise<ResultadoRelatorio> {
  const { data: movimentacoes } = await buscarTodos((de, ate) => {
    let query = supabase
      .from('movimentacoes')
      .select(
        'data, tipo, descricao, valor, status, categorias_movimentacao(nome), contas(nome), formas_pagamento(nome), membros(nome), campanhas(titulo)'
      )
      .eq('status', 'ATIVO')

    if (filtros.dataInicio) query = query.gte('data', filtros.dataInicio)
    if (filtros.dataFim) query = query.lte('data', filtros.dataFim)
    if (filtros.tipo) query = query.eq('tipo', filtros.tipo)
    if (filtros.categoriaId) query = query.eq('categoria_id', filtros.categoriaId)
    if (filtros.contaId) query = query.eq('conta_id', filtros.contaId)
    if (filtros.formaPagamentoId) query = query.eq('forma_pagamento_id', filtros.formaPagamentoId)
    if (filtros.membroId) query = query.eq('membro_id', filtros.membroId)
    if (filtros.campanhaId) query = query.eq('campanha_id', filtros.campanhaId)

    return query.order('data', { ascending: false }).order('id').range(de, ate)
  })

  const totalEntradas = (movimentacoes ?? [])
    .filter((m) => m.tipo === 'ENTRADA')
    .reduce((s, m) => s + Number(m.valor), 0)
  const totalSaidas = (movimentacoes ?? [])
    .filter((m) => m.tipo === 'SAIDA')
    .reduce((s, m) => s + Number(m.valor), 0)

  function nome(rel: { nome: string }[] | { nome: string } | null): string {
    if (!rel) return '-'
    return Array.isArray(rel) ? (rel[0]?.nome ?? '-') : rel.nome
  }

  function titulo(rel: { titulo: string }[] | { titulo: string } | null): string {
    if (!rel) return '-'
    return Array.isArray(rel) ? (rel[0]?.titulo ?? '-') : rel.titulo
  }

  return {
    titulo: 'Movimentação de entradas e saídas',
    resumo: [
      { label: 'Entradas', valor: formatarMoedaBR(totalEntradas) },
      { label: 'Saídas', valor: formatarMoedaBR(totalSaidas) },
      { label: 'Saldo do período', valor: formatarMoedaBR(totalEntradas - totalSaidas) },
    ],
    colunas: ['Data', 'Tipo', 'Categoria', 'Descrição', 'Conta', 'Forma', 'Membro', 'Campanha', 'Valor'],
    linhas: (movimentacoes ?? []).map((m) => [
      formatarDataBR(m.data),
      m.tipo === 'ENTRADA' ? 'Entrada' : 'Saída',
      nome(m.categorias_movimentacao),
      m.descricao ?? '-',
      nome(m.contas),
      nome(m.formas_pagamento),
      nome(m.membros),
      titulo(m.campanhas),
      formatarMoedaBR(Number(m.valor)),
    ]),
  }
}
