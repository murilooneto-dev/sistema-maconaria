import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarImagemUrl } from '@/lib/pdf/imagens'
import type { ImagemEmbutida } from '@/lib/pdf/recibo'

export type CabecalhoLoja = { nome: string; logo: ImagemEmbutida | null }

const NOME_PADRAO = 'Loja Maçônica'

/** Busca nome e logo da Loja para uso no cabeçalho dos relatórios em PDF. */
export async function buscarCabecalhoLoja(supabase: SupabaseClient): Promise<CabecalhoLoja> {
  const { data } = await supabase.from('loja_config').select('nome, logo_url').eq('id', 1).single()

  const logo = await buscarImagemUrl(data?.logo_url ?? null)

  return { nome: data?.nome || NOME_PADRAO, logo }
}
