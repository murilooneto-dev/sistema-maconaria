import type { createSupabaseServerClient } from '@/lib/supabase/server'

export type FiltrosCentrosDeCusto = {
  dataInicio?: string
  dataFim?: string
}

export type CentroDeCustoInput = { id: string; nome: string; cor: string }
export type VinculoCentroCategoria = { centroDeCustoId: string; categoriaId: string }

type RelacaoCategoria = { id: string; nome: string }

export type MovimentacaoBrutaCentro = {
  id: string
  data: string
  descricao: string | null
  valor: number | string
  tipo: 'ENTRADA' | 'SAIDA'
  categorias_movimentacao: RelacaoCategoria[] | RelacaoCategoria | null
}

export type MovimentacaoCentro = {
  id: string
  data: string
  categoria: string
  descricao: string
  valor: number
  tipo: 'ENTRADA' | 'SAIDA'
}

export type CategoriaResumoCentro = {
  categoriaId: string
  nome: string
  tipo: 'ENTRADA' | 'SAIDA'
  valor: number
}

export type CentroDeCustoResumo = {
  id: string
  nome: string
  cor: string
  totalEntradas: number
  totalSaidas: number
  saldo: number
  porCategoria: CategoriaResumoCentro[]
  movimentacoes: MovimentacaoCentro[]
}

export const SEM_CENTRO_ID = 'sem-centro'
const SEM_CENTRO_NOME = 'Sem centro de custo'
const SEM_CENTRO_COR = '#94a3b8'

function primeiro<T>(rel: T[] | T | null): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

type Acumulador = {
  resumo: CentroDeCustoResumo
  porCategoria: Map<string, CategoriaResumoCentro>
}

/** Agrupa movimentações ATIVAS por centro de custo, via vínculo categoria → centro(s). Função pura — sem I/O. */
export function agruparMovimentacoesPorCentroDeCusto(
  movimentacoes: MovimentacaoBrutaCentro[],
  centros: CentroDeCustoInput[],
  vinculos: VinculoCentroCategoria[]
): CentroDeCustoResumo[] {
  const centrosPorCategoria = new Map<string, string[]>()
  for (const vinculo of vinculos) {
    const lista = centrosPorCategoria.get(vinculo.categoriaId) ?? []
    lista.push(vinculo.centroDeCustoId)
    centrosPorCategoria.set(vinculo.categoriaId, lista)
  }

  const acumuladores = new Map<string, Acumulador>()

  function acumuladorDe(id: string, nome: string, cor: string): Acumulador {
    let acc = acumuladores.get(id)
    if (!acc) {
      acc = {
        resumo: { id, nome, cor, totalEntradas: 0, totalSaidas: 0, saldo: 0, porCategoria: [], movimentacoes: [] },
        porCategoria: new Map(),
      }
      acumuladores.set(id, acc)
    }
    return acc
  }

  for (const centro of centros) {
    acumuladorDe(centro.id, centro.nome, centro.cor)
  }

  for (const mov of movimentacoes) {
    const categoria = primeiro(mov.categorias_movimentacao)
    if (!categoria) continue

    const valor = Number(mov.valor)
    const centrosDaCategoria = centrosPorCategoria.get(categoria.id) ?? []
    const destinos = centrosDaCategoria.length > 0 ? centrosDaCategoria : [SEM_CENTRO_ID]

    for (const centroId of destinos) {
      const acc = acumuladorDe(centroId, centroId === SEM_CENTRO_ID ? SEM_CENTRO_NOME : centroId, SEM_CENTRO_COR)

      if (mov.tipo === 'ENTRADA') {
        acc.resumo.totalEntradas += valor
      } else {
        acc.resumo.totalSaidas += valor
      }
      acc.resumo.saldo = acc.resumo.totalEntradas - acc.resumo.totalSaidas

      acc.resumo.movimentacoes.push({
        id: mov.id,
        data: mov.data,
        categoria: categoria.nome,
        descricao: mov.descricao ?? '-',
        valor,
        tipo: mov.tipo,
      })

      const categoriaAcc = acc.porCategoria.get(categoria.id)
      if (categoriaAcc) {
        categoriaAcc.valor += valor
      } else {
        acc.porCategoria.set(categoria.id, { categoriaId: categoria.id, nome: categoria.nome, tipo: mov.tipo, valor })
      }
    }
  }

  const resultado: CentroDeCustoResumo[] = []
  for (const centro of centros) {
    const acc = acumuladores.get(centro.id)!
    resultado.push({
      ...acc.resumo,
      porCategoria: [...acc.porCategoria.values()].sort((a, b) => b.valor - a.valor),
      movimentacoes: [...acc.resumo.movimentacoes].sort((a, b) => (a.data < b.data ? 1 : -1)),
    })
  }

  const semCentro = acumuladores.get(SEM_CENTRO_ID)
  if (semCentro && semCentro.resumo.movimentacoes.length > 0) {
    resultado.push({
      ...semCentro.resumo,
      porCategoria: [...semCentro.porCategoria.values()].sort((a, b) => b.valor - a.valor),
      movimentacoes: [...semCentro.resumo.movimentacoes].sort((a, b) => (a.data < b.data ? 1 : -1)),
    })
  }

  return resultado
}

export async function buscarDadosCentrosDeCusto(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filtros: FiltrosCentrosDeCusto
): Promise<CentroDeCustoResumo[]> {
  const [centrosRes, vinculosRes, movimentacoesRes] = await Promise.all([
    supabase.from('centros_de_custo').select('id, nome, cor').eq('ativo', true).order('nome'),
    supabase.from('centros_de_custo_categorias').select('centro_de_custo_id, categoria_id'),
    (() => {
      let query = supabase
        .from('movimentacoes')
        .select('id, data, descricao, valor, tipo, categorias_movimentacao(id, nome)')
        .eq('status', 'ATIVO')
      if (filtros.dataInicio) query = query.gte('data', filtros.dataInicio)
      if (filtros.dataFim) query = query.lte('data', filtros.dataFim)
      return query
    })(),
  ])

  if (centrosRes.error) throw centrosRes.error
  if (vinculosRes.error) throw vinculosRes.error
  if (movimentacoesRes.error) throw movimentacoesRes.error

  const centros: CentroDeCustoInput[] = (centrosRes.data ?? []).map((c) => ({ id: c.id, nome: c.nome, cor: c.cor }))
  const idsAtivos = new Set(centros.map((c) => c.id))
  const vinculos: VinculoCentroCategoria[] = (vinculosRes.data ?? [])
    .filter((v) => idsAtivos.has(v.centro_de_custo_id))
    .map((v) => ({
      centroDeCustoId: v.centro_de_custo_id,
      categoriaId: v.categoria_id,
    }))

  return agruparMovimentacoesPorCentroDeCusto(
    (movimentacoesRes.data ?? []) as unknown as MovimentacaoBrutaCentro[],
    centros,
    vinculos
  )
}
