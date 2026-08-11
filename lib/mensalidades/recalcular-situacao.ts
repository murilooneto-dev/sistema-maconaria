import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularSituacaoMembro, contarCompetenciasVencidasNaoPagas } from '@/lib/domain/inadimplencia'

/**
 * Recalcula e persiste a situação (ATIVO/INATIVO) de um membro com base
 * nas competências vencidas e não pagas. Membros fora do quadro
 * (do_quadro=false) são ignorados — decisão confirmada com o usuário em
 * 2026-08-11.
 */
export async function recalcularSituacaoMembro(
  supabaseAdmin: SupabaseClient,
  membroId: string
): Promise<void> {
  const { data: membro } = await supabaseAdmin
    .from('membros')
    .select('do_quadro, situacao')
    .eq('id', membroId)
    .single()

  if (!membro || !membro.do_quadro) {
    return
  }

  const { data: mensalidades } = await supabaseAdmin
    .from('mensalidades')
    .select('ano, mes, status')
    .eq('membro_id', membroId)

  const hoje = new Date()
  const competenciaAtual = { ano: hoje.getUTCFullYear(), mes: hoje.getUTCMonth() + 1 }

  const vencidasNaoPagas = contarCompetenciasVencidasNaoPagas(mensalidades ?? [], competenciaAtual)
  const novaSituacao = calcularSituacaoMembro(vencidasNaoPagas)

  if (novaSituacao !== membro.situacao) {
    await supabaseAdmin.from('membros').update({ situacao: novaSituacao }).eq('id', membroId)
  }
}
