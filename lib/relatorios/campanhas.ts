import type { createSupabaseServerClient } from '@/lib/supabase/server'
import { calcularArrecadado, calcularPercentual } from '@/lib/domain/campanhas'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'
import { buscarTodos } from '@/lib/supabase/buscar-todos'
import type { ResultadoRelatorio } from './tipos'

const STATUS_LABEL: Record<string, string> = {
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
}

export type FiltrosCampanhas = { status?: string; campanhaId?: string }

export async function buscarRelatorioCampanhas(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filtros: FiltrosCampanhas
): Promise<ResultadoRelatorio> {
  if (filtros.campanhaId) {
    return buscarRelatorioCampanhaEspecifica(supabase, filtros.campanhaId)
  }

  let query = supabase
    .from('campanhas')
    .select('titulo, meta, status, doacoes(valor, status)')
    .order('created_at', { ascending: false })

  if (filtros.status) query = query.eq('status', filtros.status)

  const { data: campanhas } = await query

  return {
    titulo: 'Resumo geral de campanhas',
    resumo: [{ label: 'Total de campanhas', valor: String(campanhas?.length ?? 0) }],
    colunas: ['Título', 'Meta', 'Arrecadado', 'Saldo', '% da meta', 'Status'],
    linhas: (campanhas ?? []).map((c) => {
      const ativas = (c.doacoes ?? []).filter((d: { status: string }) => d.status === 'ATIVO')
      const arrecadado = calcularArrecadado(ativas)
      const meta = Number(c.meta)
      const percentual = calcularPercentual(arrecadado, meta)
      return [
        c.titulo,
        formatarMoedaBR(meta),
        formatarMoedaBR(arrecadado),
        formatarMoedaBR(Math.max(0, meta - arrecadado)),
        `${percentual.toFixed(0)}%`,
        STATUS_LABEL[c.status] ?? c.status,
      ]
    }),
  }
}

async function buscarRelatorioCampanhaEspecifica(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  campanhaId: string
): Promise<ResultadoRelatorio> {
  const { data: campanha } = await supabase.from('campanhas').select('*').eq('id', campanhaId).single()

  if (!campanha) {
    return { titulo: 'Campanha não encontrada', colunas: [], linhas: [] }
  }

  const { data: doacoes } = await buscarTodos((de, ate) =>
    supabase
      .from('doacoes')
      .select('doador, valor, data, status, membros(nome)')
      .eq('campanha_id', campanhaId)
      .order('data', { ascending: false })
      .order('id')
      .range(de, ate)
  )

  const ativas = (doacoes ?? []).filter((d) => d.status === 'ATIVO')
  const arrecadado = calcularArrecadado(ativas)
  const meta = Number(campanha.meta)

  return {
    titulo: `Campanha: ${campanha.titulo}`,
    subtitulo: campanha.objetivo ?? undefined,
    resumo: [
      { label: 'Meta', valor: formatarMoedaBR(meta) },
      { label: 'Arrecadado', valor: formatarMoedaBR(arrecadado) },
      { label: 'Percentual', valor: `${calcularPercentual(arrecadado, meta).toFixed(0)}%` },
      { label: 'Status', valor: STATUS_LABEL[campanha.status] ?? campanha.status },
    ],
    colunas: ['Data', 'Doador', 'Membro', 'Valor', 'Situação'],
    linhas: (doacoes ?? []).map((d) => {
      const membro = Array.isArray(d.membros) ? d.membros[0] : d.membros
      return [
        formatarDataBR(d.data),
        d.doador,
        membro?.nome ?? '-',
        formatarMoedaBR(Number(d.valor)),
        d.status === 'ATIVO' ? 'Ativa' : 'Cancelada',
      ]
    }),
  }
}
