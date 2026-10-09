import type { createSupabaseServerClient } from '@/lib/supabase/server'
import { calcularTotal } from '@/lib/domain/grande-loja'
import { formatarMoedaBR } from '@/lib/format'
import { buscarTodos } from '@/lib/supabase/buscar-todos'
import type { ResultadoRelatorio } from './tipos'

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  ENVIADO: 'Enviado',
  CANCELADO: 'Cancelado',
}

export type FiltrosGrandeLoja = { ano?: string; mes?: string; status?: string }

export async function buscarRelatorioGrandeLoja(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filtros: FiltrosGrandeLoja
): Promise<ResultadoRelatorio> {
  const { data: itens } = await buscarTodos((de, ate) => {
    let query = supabase
      .from('repasses_grande_loja_itens')
      .select('valor, status, mensalidades(ano, mes, membros(nome)), repasses_grande_loja(data_envio)')

    if (filtros.status) query = query.eq('status', filtros.status)

    return query.order('created_at', { ascending: false }).order('id').range(de, ate)
  })

  function primeiro<T>(rel: T[] | T | null): T | null {
    if (!rel) return null
    return Array.isArray(rel) ? (rel[0] ?? null) : rel
  }

  const linhasFiltradas =(itens ?? []).filter((item) => {
    if (!filtros.ano || !filtros.mes) return true
    const repasse = primeiro(item.repasses_grande_loja)
    if (!repasse?.data_envio) return false
    const [ano, mes] = repasse.data_envio.split('-')
    return ano === filtros.ano && Number(mes) === Number(filtros.mes)
  })

  const totalValor = calcularTotal(linhasFiltradas)
  const totalEnviados = linhasFiltradas.filter((i) => i.status === 'ENVIADO').length
  const totalPendentes = linhasFiltradas.filter((i) => i.status === 'PENDENTE').length

  return {
    titulo: 'Relatório Grande Loja',
    resumo: [
      { label: 'Total de itens', valor: String(linhasFiltradas.length) },
      { label: 'Pendentes', valor: String(totalPendentes) },
      { label: 'Enviados', valor: String(totalEnviados) },
      { label: 'Valor total', valor: formatarMoedaBR(totalValor) },
    ],
    colunas: ['Membro', 'Competência', 'Valor GL', 'Situação'],
    linhas: linhasFiltradas.map((item) => {
      const m = primeiro(item.mensalidades)
      const membro = m ? primeiro(m.membros) : null
      const competencia = m ? `${String(m.mes).padStart(2, '0')}/${m.ano}` : '-'
      return [membro?.nome ?? '-', competencia, formatarMoedaBR(Number(item.valor)), STATUS_LABEL[item.status] ?? item.status]
    }),
  }
}
