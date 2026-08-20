import type { CentroDeCustoResumo } from './centros-de-custo'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'
import type { ResultadoRelatorio } from './tipos'

/** Restringe o resultado de buscarDadosCentrosDeCusto a um único centro (ou nenhum filtro). Função pura — sem I/O. */
export function filtrarCentroDeCusto(
  centros: CentroDeCustoResumo[],
  centroDeCustoId?: string
): CentroDeCustoResumo[] {
  if (!centroDeCustoId) return centros
  return centros.filter((c) => c.id === centroDeCustoId)
}

export type LancamentoCentroDetalhado = { data: string; descricao: string; valor: number }

export type CategoriaCentroDetalhada = {
  nome: string
  tipo: 'ENTRADA' | 'SAIDA'
  total: number
  lancamentos: LancamentoCentroDetalhado[]
}

export type CentroDeCustoDetalhado = {
  id: string
  nome: string
  cor: string
  totalEntradas: number
  totalSaidas: number
  saldo: number
  categorias: CategoriaCentroDetalhada[]
}

/** Reagrupa as movimentações (já achatadas) de cada centro por nome de categoria, para exibição em 3 níveis. Função pura — sem I/O. */
export function detalharCentrosDeCusto(centros: CentroDeCustoResumo[]): CentroDeCustoDetalhado[] {
  return centros.map((centro) => {
    const porCategoria = new Map<string, CategoriaCentroDetalhada>()

    for (const mov of centro.movimentacoes) {
      let entry = porCategoria.get(mov.categoria)
      if (!entry) {
        entry = { nome: mov.categoria, tipo: mov.tipo, total: 0, lancamentos: [] }
        porCategoria.set(mov.categoria, entry)
      }
      entry.total += mov.valor
      entry.lancamentos.push({ data: mov.data, descricao: mov.descricao, valor: mov.valor })
    }

    const categorias = [...porCategoria.values()]
      .sort((a, b) => b.total - a.total)
      .map((c) => ({ ...c, lancamentos: [...c.lancamentos].sort((a, b) => (a.data < b.data ? 1 : -1)) }))

    return {
      id: centro.id,
      nome: centro.nome,
      cor: centro.cor,
      totalEntradas: centro.totalEntradas,
      totalSaidas: centro.totalSaidas,
      saldo: centro.saldo,
      categorias,
    }
  })
}

/** Achata os centros detalhados em linhas para exportação PDF/CSV — cabeçalho de centro, subtotal por categoria e linha de detalhe de cada lançamento. */
export function centrosDeCustoParaResultado(centros: CentroDeCustoDetalhado[]): ResultadoRelatorio {
  const linhas: string[][] = []

  for (const centro of centros) {
    if (centro.categorias.length === 0) continue

    linhas.push([`CENTRO: ${centro.nome.toUpperCase()}`, '', formatarMoedaBR(centro.saldo)])

    for (const categoria of centro.categorias) {
      linhas.push([`${categoria.nome} (subtotal)`, '-', formatarMoedaBR(categoria.total)])
      for (const lanc of categoria.lancamentos) {
        linhas.push([`— ${lanc.descricao}`, formatarDataBR(lanc.data), formatarMoedaBR(lanc.valor)])
      }
    }
  }

  const totalEntradas = centros.reduce((s, c) => s + c.totalEntradas, 0)
  const totalSaidas = centros.reduce((s, c) => s + c.totalSaidas, 0)

  return {
    titulo: 'Relatório por centro de custo',
    resumo: [
      { label: 'Entradas', valor: formatarMoedaBR(totalEntradas) },
      { label: 'Saídas', valor: formatarMoedaBR(totalSaidas) },
      { label: 'Saldo do período', valor: formatarMoedaBR(totalEntradas - totalSaidas) },
    ],
    colunas: ['Centro / Categoria / Lançamento', 'Data', 'Valor'],
    linhas,
  }
}
