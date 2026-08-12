import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { competenciasFaltantes, proximaCompetenciaAposCadastro, type Competencia } from '@/lib/domain/competencias'

type MembroParaGeracao = {
  id: string
  remido: boolean
  data_cadastro: string
}

/**
 * Gera as competências pendentes de UM membro, do mês seguinte ao cadastro
 * (SPEC §10) até dezembro do ano corrente — inclui competências futuras
 * ainda não vencidas (decisão confirmada com o usuário em 2026-08-12: "as
 * mensalidades do momento que ele entrou e as FUTURAS, nunca para trás").
 * Usa a configuração de mensalidade vigente hoje, gravada como snapshot em
 * cada competência gerada; se a configuração mudar depois, as competências
 * futuras já geradas NÃO são recalculadas (regra de ouro de imutabilidade
 * histórica — trade-off aceito explicitamente pelo usuário). Não gera nada
 * se não houver configuração cadastrada para o tipo do membro (normal/remido),
 * ou se não houver competência pendente (ex: cadastro em dezembro).
 *
 * Usada tanto pela geração em lote (`gerarMensalidades`) quanto
 * automaticamente ao cadastrar um membro (`criarMembro`).
 */
export async function gerarCompetenciasParaMembro(
  supabaseAdmin: SupabaseClient,
  membro: MembroParaGeracao
): Promise<number> {
  const hoje = new Date()
  const fimDoAno: Competencia = { ano: hoje.getUTCFullYear(), mes: 12 }

  const { data: config } = await supabaseAdmin
    .from('config_mensalidade')
    .select('valor_mensalidade, valor_grande_loja, valor_loja')
    .eq('tipo', membro.remido ? 'REMIDO' : 'NORMAL')
    .order('vigente_desde', { ascending: false })
    .limit(1)
    .single()

  if (!config) {
    return 0
  }

  const primeira = proximaCompetenciaAposCadastro(membro.data_cadastro)

  const { data: existentes } = await supabaseAdmin
    .from('mensalidades')
    .select('ano, mes')
    .eq('membro_id', membro.id)

  const faltantes = competenciasFaltantes(primeira, fimDoAno, existentes ?? [])

  if (faltantes.length === 0) {
    return 0
  }

  const novasLinhas = faltantes.map((competencia) => ({
    membro_id: membro.id,
    ano: competencia.ano,
    mes: competencia.mes,
    valor_devido: config.valor_mensalidade,
    valor_grande_loja: config.valor_grande_loja,
    valor_loja: config.valor_loja,
  }))

  const { error } = await supabaseAdmin.from('mensalidades').insert(novasLinhas)

  if (error) {
    throw new Error(`Falha ao gerar competências: ${error.message}`)
  }

  return novasLinhas.length
}
