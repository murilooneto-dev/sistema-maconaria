import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { calcularArrecadado, deveConcluirAutomaticamente } from '@/lib/domain/campanhas'

/** SPEC §24: ao atingir a meta, EM_ANDAMENTO → CONCLUIDA automaticamente. Nunca reabre sozinho — reabertura é sempre manual. */
export async function recalcularStatusCampanha(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  campanhaId: string
): Promise<void> {
  const { data: campanha } = await supabaseAdmin
    .from('campanhas')
    .select('id, status, meta')
    .eq('id', campanhaId)
    .single()

  if (!campanha || campanha.status !== 'EM_ANDAMENTO') {
    return
  }

  const { data: doacoes } = await supabaseAdmin
    .from('doacoes')
    .select('valor')
    .eq('campanha_id', campanhaId)
    .eq('status', 'ATIVO')

  const arrecadado = calcularArrecadado(doacoes ?? [])

  if (deveConcluirAutomaticamente({ status: campanha.status, meta: Number(campanha.meta), arrecadado })) {
    await supabaseAdmin.from('campanhas').update({ status: 'CONCLUIDA' }).eq('id', campanhaId).eq('status', 'EM_ANDAMENTO')
  }
}
