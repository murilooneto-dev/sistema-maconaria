import type { createSupabaseServerClient } from '@/lib/supabase/server'
import { contarCompetenciasVencidasNaoPagas, competenciaVencida } from '@/lib/domain/inadimplencia'
import type { ResultadoRelatorio } from './tipos'

export type FiltrosMensalidades = { situacao?: string }

export async function buscarRelatorioMensalidades(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filtros: FiltrosMensalidades
): Promise<ResultadoRelatorio> {
  let queryMembros = supabase.from('membros').select('id, nome, situacao').eq('do_quadro', true).order('nome')
  if (filtros.situacao) queryMembros = queryMembros.eq('situacao', filtros.situacao)

  const { data: membros } = await queryMembros
  const membroIds = (membros ?? []).map((m) => m.id)

  const { data: mensalidades } =
    membroIds.length > 0
      ? await supabase
          .from('mensalidades')
          .select('membro_id, ano, mes, status, saldo')
          .in('membro_id', membroIds)
      : { data: [] as { membro_id: string; ano: number; mes: number; status: string; saldo: number }[] }

  const hoje = new Date()
  const competenciaHoje = { ano: hoje.getUTCFullYear(), mes: hoje.getUTCMonth() + 1 }

  const linhas = (membros ?? []).map((membro) => {
    const doMembro = (mensalidades ?? []).filter((m) => m.membro_id === membro.id)
    const vencidas = contarCompetenciasVencidasNaoPagas(doMembro, competenciaHoje)
    const valorDevido = doMembro
      .filter((m) => (m.status === 'PENDENTE' || m.status === 'PARCIAL') && competenciaVencida(m, competenciaHoje))
      .reduce((s, m) => s + Number(m.saldo), 0)

    return [
      membro.nome,
      membro.situacao === 'ATIVO' ? 'Ativo' : 'Inativo',
      String(vencidas),
      `R$ ${valorDevido.toFixed(2)}`,
    ]
  })

  const totalInadimplentes = linhas.filter((l) => Number(l[2]) > 0).length

  return {
    titulo: 'Mensalidades / Inadimplência',
    resumo: [
      { label: 'Membros do quadro', valor: String(membros?.length ?? 0) },
      { label: 'Com competências vencidas', valor: String(totalInadimplentes) },
    ],
    colunas: ['Membro', 'Situação', 'Competências vencidas', 'Valor devido (vencidas)'],
    linhas,
  }
}
