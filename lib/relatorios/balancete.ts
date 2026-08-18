import type { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'
import type { ResultadoRelatorio } from './tipos'

export type FiltrosBalancete = {
  dataInicio?: string
  dataFim?: string
}

export type LancamentoBalancete = {
  data: string
  descricao: string
  conta: string
  formaPagamento: string
  valor: number
}

export type CategoriaBalancete = {
  id: string
  nome: string
  total: number
  lancamentos: LancamentoBalancete[]
}

export type GrupoBalancete = {
  tipo: 'ENTRADA' | 'SAIDA'
  label: string
  total: number
  categorias: CategoriaBalancete[]
}

export type Balancete = {
  grupos: GrupoBalancete[]
  totalEntradas: number
  totalSaidas: number
  saldoPeriodo: number
}

type RelacaoCategoria = { id: string; nome: string; tipo: string }
type RelacaoNome = { nome: string }

export type MovimentacaoBrutaBalancete = {
  data: string
  descricao: string | null
  valor: number | string
  categorias_movimentacao: RelacaoCategoria[] | RelacaoCategoria | null
  contas: RelacaoNome[] | RelacaoNome | null
  formas_pagamento: RelacaoNome[] | RelacaoNome | null
}

function primeiro<T>(rel: T[] | T | null): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

const LABEL_GRUPO: Record<'ENTRADA' | 'SAIDA', string> = {
  ENTRADA: 'Entradas',
  SAIDA: 'Saídas',
}

/** Agrupa movimentações ATIVAS em um balancete por categoria, separado em Entradas e Saídas. Função pura — sem I/O. */
export function agruparMovimentacoesEmBalancete(movimentacoes: MovimentacaoBrutaBalancete[]): Balancete {
  const categoriasPorId = new Map<string, CategoriaBalancete & { tipo: 'ENTRADA' | 'SAIDA' }>()

  for (const mov of movimentacoes) {
    const categoria = primeiro(mov.categorias_movimentacao)
    if (!categoria) continue

    const tipo = categoria.tipo === 'SAIDA' ? 'SAIDA' : 'ENTRADA'
    const conta = primeiro(mov.contas)
    const forma = primeiro(mov.formas_pagamento)
    const valor = Number(mov.valor)

    let entry = categoriasPorId.get(categoria.id)
    if (!entry) {
      entry = { id: categoria.id, nome: categoria.nome, tipo, total: 0, lancamentos: [] }
      categoriasPorId.set(categoria.id, entry)
    }

    entry.total += valor
    entry.lancamentos.push({
      data: mov.data,
      descricao: mov.descricao ?? '-',
      conta: conta?.nome ?? '-',
      formaPagamento: forma?.nome ?? '-',
      valor,
    })
  }

  function montarGrupo(tipo: 'ENTRADA' | 'SAIDA'): GrupoBalancete {
    const categorias = [...categoriasPorId.values()]
      .filter((c) => c.tipo === tipo)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(({ id, nome, total, lancamentos }) => ({ id, nome, total, lancamentos }))
    const total = categorias.reduce((s, c) => s + c.total, 0)
    return { tipo, label: LABEL_GRUPO[tipo], total, categorias }
  }

  const grupoEntradas = montarGrupo('ENTRADA')
  const grupoSaidas = montarGrupo('SAIDA')

  return {
    grupos: [grupoEntradas, grupoSaidas],
    totalEntradas: grupoEntradas.total,
    totalSaidas: grupoSaidas.total,
    saldoPeriodo: grupoEntradas.total - grupoSaidas.total,
  }
}

export async function buscarBalancete(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filtros: FiltrosBalancete
): Promise<Balancete> {
  let query = supabase
    .from('movimentacoes')
    .select('data, descricao, valor, categorias_movimentacao(id, nome, tipo), contas(nome), formas_pagamento(nome)')
    .eq('status', 'ATIVO')
    .order('data', { ascending: true })

  if (filtros.dataInicio) query = query.gte('data', filtros.dataInicio)
  if (filtros.dataFim) query = query.lte('data', filtros.dataFim)

  const { data } = await query

  return agruparMovimentacoesEmBalancete((data ?? []) as unknown as MovimentacaoBrutaBalancete[])
}

/** Achata o balancete hierárquico em linhas para exportação PDF/CSV — cabeçalho de grupo, subtotal por categoria e linhas de detalhe de cada lançamento. */
export function balanceteParaResultado(balancete: Balancete): ResultadoRelatorio {
  const linhas: string[][] = []

  for (const grupo of balancete.grupos) {
    if (grupo.categorias.length === 0) continue

    linhas.push([grupo.label.toUpperCase(), '', '', '', ''])

    for (const categoria of grupo.categorias) {
      linhas.push([`${categoria.nome} (subtotal)`, '-', '-', '-', formatarMoedaBR(categoria.total)])
      for (const lanc of categoria.lancamentos) {
        linhas.push([`— ${lanc.descricao}`, formatarDataBR(lanc.data), lanc.conta, lanc.formaPagamento, formatarMoedaBR(lanc.valor)])
      }
    }
  }

  return {
    titulo: 'Balancete financeiro (analítico)',
    resumo: [
      { label: 'Entradas', valor: formatarMoedaBR(balancete.totalEntradas) },
      { label: 'Saídas', valor: formatarMoedaBR(balancete.totalSaidas) },
      { label: 'Saldo do período', valor: formatarMoedaBR(balancete.saldoPeriodo) },
    ],
    colunas: ['Categoria / Lançamento', 'Data', 'Conta', 'Forma', 'Valor'],
    linhas,
  }
}
