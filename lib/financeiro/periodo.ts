import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'

/** true se o mês da data informada (YYYY-MM-DD) já tiver um fechamento com status FECHADO. */
export async function periodoEstaFechado(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  dataISO: string
): Promise<boolean> {
  const [ano, mes] = dataISO.split('-').map(Number)
  const { data } = await supabaseAdmin
    .from('fechamentos_mensais')
    .select('id')
    .eq('ano', ano)
    .eq('mes', mes)
    .eq('status', 'FECHADO')
    .maybeSingle()
  return Boolean(data)
}
