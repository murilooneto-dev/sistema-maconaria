import 'server-only'
import type { createSupabaseServiceRoleClient } from '@/lib/supabase/service'

const BUCKET = 'anexos'
const EXPIRACAO_SEGUNDOS = 300 // 5 minutos

export async function gerarUrlAssinada(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  path: string
): Promise<{ url: string } | { error: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, EXPIRACAO_SEGUNDOS)

  if (error || !data) {
    return { error: `Falha ao gerar link de download: ${error?.message ?? 'erro desconhecido'}` }
  }

  return { url: data.signedUrl }
}
