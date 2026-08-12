import type { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatarDataBR } from '@/lib/format'
import type { ResultadoRelatorio } from './tipos'

export type FiltrosMembros = { situacao?: string; doQuadro?: string; remido?: string }

export async function buscarRelatorioMembros(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filtros: FiltrosMembros
): Promise<ResultadoRelatorio> {
  let query = supabase
    .from('membros')
    .select('nome, matricula, situacao, remido, do_quadro, data_cadastro')
    .order('nome')

  if (filtros.situacao) query = query.eq('situacao', filtros.situacao)
  if (filtros.doQuadro) query = query.eq('do_quadro', filtros.doQuadro === 'true')
  if (filtros.remido) query = query.eq('remido', filtros.remido === 'true')

  const { data: membros } = await query

  const total = membros?.length ?? 0
  const ativos = (membros ?? []).filter((m) => m.situacao === 'ATIVO').length
  const inativos = total - ativos

  return {
    titulo: 'Resumo de membros',
    resumo: [
      { label: 'Total', valor: String(total) },
      { label: 'Ativos', valor: String(ativos) },
      { label: 'Inativos', valor: String(inativos) },
    ],
    colunas: ['Nome', 'Matrícula', 'Situação', 'Remido', 'Do quadro', 'Data de cadastro'],
    linhas: (membros ?? []).map((m) => [
      m.nome,
      m.matricula,
      m.situacao === 'ATIVO' ? 'Ativo' : 'Inativo',
      m.remido ? 'Sim' : 'Não',
      m.do_quadro ? 'Sim' : 'Não',
      formatarDataBR(m.data_cadastro),
    ]),
  }
}
