import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import type { ImagemEmbutida } from '@/lib/pdf/recibo'

/**
 * Detecta o formato pelos bytes reais do arquivo (assinatura mágica),
 * não pela extensão do nome — mais confiável, já que o pdf-lib só lê
 * PNG/JPEG e uma extensão errada faria a imagem sumir silenciosamente do
 * recibo.
 */
function detectarFormato(bytes: Uint8Array): 'png' | 'jpg' | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png'
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'jpg'
  }
  return null
}

/** Baixa uma imagem de um bucket do Storage e devolve os bytes prontos para embutir no PDF (pdf-lib só lê PNG/JPEG). */
export async function buscarImagemStorage(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  bucket: string,
  path: string | null
): Promise<ImagemEmbutida | null> {
  if (!path) return null

  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path)
  if (error || !data) {
    console.error(`Falha ao baixar imagem "${path}" do bucket "${bucket}":`, error?.message)
    return null
  }

  const bytes = new Uint8Array(await data.arrayBuffer())
  const formato = detectarFormato(bytes)
  if (!formato) {
    console.error(`Imagem "${path}" do bucket "${bucket}" não é PNG nem JPEG — não pode ser embutida no PDF.`)
    return null
  }

  return { bytes, formato }
}
