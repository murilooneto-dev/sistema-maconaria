import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { competenciasFaltantes, type Competencia } from '@/lib/domain/competencias'

type MembroParaGeracao = {
  id: string
  remido: boolean
  data_cadastro: string
}

/**
 * Gera as competências pendentes de UM membro, de janeiro a dezembro do ano
 * corrente — independente da data de cadastro (decisão explícita do
 * usuário, 2026-08-13: a maioria dos membros cadastrados/importados no
 * sistema já são membros antigos da Loja sendo digitalizados agora, não
 * gente entrando hoje, então cobrar só a partir do mês seguinte ao cadastro
 * — como pedia o SPEC §10 originalmente — deixava o ano incompleto pra
 * eles). Isso substitui a regra anterior de "mês seguinte ao cadastro"; se
 * um membro realmente novo entrar no meio do ano, este botão/fluxo também
 * vai gerar os meses anteriores à entrada dele — aceito conscientemente
 * pelo usuário como trade-off.
 *
 * Usa a configuração de mensalidade vigente hoje, gravada como snapshot em
 * cada competência gerada; se a configuração mudar depois, as competências
 * já geradas NÃO são recalculadas (regra de ouro de imutabilidade
 * histórica). Não gera nada se não houver configuração cadastrada para o
 * tipo do membro (normal/remido).
 *
 * Usada tanto pela geração em lote (`gerarMensalidades`) quanto
 * automaticamente ao cadastrar um membro (`criarMembro`) e pela importação
 * via CSV.
 */
export async function gerarCompetenciasParaMembro(
  supabaseAdmin: SupabaseClient,
  membro: MembroParaGeracao
): Promise<number> {
  const hoje = new Date()
  const primeiroDoAno: Competencia = { ano: hoje.getUTCFullYear(), mes: 1 }
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

  const { data: existentes } = await supabaseAdmin
    .from('mensalidades')
    .select('ano, mes')
    .eq('membro_id', membro.id)

  const faltantes = competenciasFaltantes(primeiroDoAno, fimDoAno, existentes ?? [])

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
