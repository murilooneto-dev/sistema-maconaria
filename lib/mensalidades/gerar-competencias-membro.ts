import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { competenciasFaltantes, primeiraCompetenciaDoAno, type Competencia } from '@/lib/domain/competencias'
import { competenciaAtual } from '@/lib/datas'

type MembroParaGeracao = {
  id: string
  remido: boolean
  data_cadastro: string
}

/**
 * `MES_DO_CADASTRO`: do mês em que o membro foi cadastrado até dezembro
 * (ou o ano inteiro, se o cadastro é de um ano anterior).
 * `ANO_COMPLETO`: de janeiro a dezembro, ignorando a data de cadastro.
 */
export type InicioGeracao = 'MES_DO_CADASTRO' | 'ANO_COMPLETO'

/**
 * Gera as competências pendentes de UM membro no ano corrente.
 *
 * Regra padrão (decisão do usuário, 2026-10-09 — SPEC §10): só do mês do
 * cadastro em diante. Quem entra em outubro não é cobrado de janeiro a
 * setembro. Vale para o cadastro manual (`criarMembro`) e para a geração
 * em lote (`gerarMensalidades`) — se o lote ignorasse a data de cadastro,
 * o próximo clique em "Gerar mensalidades" recriaria os meses anteriores.
 *
 * A importação via CSV continua usando `ANO_COMPLETO` (decisão do usuário,
 * 2026-08-13): ela digitaliza membros antigos da Loja, que devem o ano
 * inteiro mesmo tendo sido lançados no sistema no meio dele.
 *
 * Usa a configuração de mensalidade vigente hoje, gravada como snapshot em
 * cada competência gerada; se a configuração mudar depois, as competências
 * já geradas NÃO são recalculadas (regra de ouro de imutabilidade
 * histórica). Não gera nada se não houver configuração cadastrada para o
 * tipo do membro (normal/remido).
 */
export async function gerarCompetenciasParaMembro(
  supabaseAdmin: SupabaseClient,
  membro: MembroParaGeracao,
  inicio: InicioGeracao = 'MES_DO_CADASTRO'
): Promise<number> {
  const anoCorrente = competenciaAtual().ano
  const primeira: Competencia =
    inicio === 'ANO_COMPLETO'
      ? { ano: anoCorrente, mes: 1 }
      : primeiraCompetenciaDoAno(membro.data_cadastro, anoCorrente)
  const fimDoAno: Competencia = { ano: anoCorrente, mes: 12 }

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
