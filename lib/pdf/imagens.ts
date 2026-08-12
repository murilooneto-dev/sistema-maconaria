import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import type { ImagemEmbutida } from '@/lib/pdf/recibo'

function detectarFormato(path: string): 'png' | 'jpg' | null {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'png'
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg'
  return null
}

/** Baixa uma imagem de um bucket do Storage e devolve os bytes prontos para embutir no PDF (pdf-lib só lê PNG/JPEG). */
export async function buscarImagemStorage(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  bucket: string,
  path: string | null
): Promise<ImagemEmbutida | null> {
  if (!path) return null

  const formato = detectarFormato(path)
  if (!formato) return null

  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path)
  if (error || !data) return null

  const bytes = new Uint8Array(await data.arrayBuffer())
  return { bytes, formato }
}
