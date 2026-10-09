import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { buscarTodos } from '@/lib/supabase/buscar-todos'
import { emailConfigurado, enviarEmail } from '@/lib/email/enviar'
import { montarEmailLembrete, type ContaLembrete } from '@/lib/contas-pagar-receber/lembrete'
import {
  DIAS_ANTECEDENCIA_LEMBRETE,
  deveEnviarLembrete,
  separarParaLembrete,
  somarDias,
} from '@/lib/domain/contas-pagar-receber'
import { hojeISO } from '@/lib/datas'

export const dynamic = 'force-dynamic'

/**
 * Rotina diária (Vercel Cron, ver vercel.json): envia aos Administradores e
 * Tesoureiros ativos com e-mail cadastrado o lembrete das contas a pagar e
 * a receber que vencem hoje ou daqui a 3 dias, listando junto as vencidas.
 *
 * Não tem sessão de usuário: a Vercel chama com `Authorization: Bearer
 * <CRON_SECRET>`, e sem esse segredo a rota recusa. No máximo um envio por
 * dia (tabela lembretes_contas_envios).
 */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  if (!emailConfigurado()) {
    return NextResponse.json({ erro: 'Envio de e-mail não configurado.' }, { status: 503 })
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const hoje = hojeISO()

  const { data: contas, error: contasError } = await buscarTodos<ContaLembrete>((de, ate) =>
    supabaseAdmin
      .from('contas_pagar_receber')
      .select('tipo, nome, valor, data_vencimento, status, parcela, total_parcelas')
      .eq('status', 'ABERTA')
      .lte('data_vencimento', somarDias(hoje, DIAS_ANTECEDENCIA_LEMBRETE))
      .order('data_vencimento')
      .order('id')
      .range(de, ate)
  )

  if (contasError || !contas) {
    return NextResponse.json({ erro: `Falha ao buscar contas: ${contasError?.message}` }, { status: 500 })
  }

  const grupos = separarParaLembrete(contas, hoje)
  if (!deveEnviarLembrete(grupos)) {
    return NextResponse.json({ enviado: false, motivo: 'Nenhuma conta vencendo hoje ou em breve.' })
  }

  const { data: destinatarios } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .in('role', ['ADMINISTRADOR', 'TESOUREIRO'])
    .eq('ativo', true)
    .not('email', 'is', null)

  const emails = (destinatarios ?? []).map((d) => d.email as string)
  if (emails.length === 0) {
    return NextResponse.json({ enviado: false, motivo: 'Nenhum Administrador ou Tesoureiro com e-mail cadastrado.' })
  }

  const totalContas = grupos.venceHoje.length + grupos.venceEmBreve.length + grupos.vencidas.length

  // Registra o envio do dia ANTES de enviar: se a rotina for disparada duas
  // vezes, a segunda bate na chave primária e para aqui.
  const { error: registroError } = await supabaseAdmin
    .from('lembretes_contas_envios')
    .insert({ data: hoje, destinatarios: emails.length, contas: totalContas })

  if (registroError) {
    if (registroError.code === '23505') {
      return NextResponse.json({ enviado: false, motivo: 'Lembrete de hoje já enviado.' })
    }
    return NextResponse.json({ erro: `Falha ao registrar envio: ${registroError.message}` }, { status: 500 })
  }

  const { data: loja } = await supabaseAdmin.from('loja_config').select('nome').eq('id', 1).maybeSingle()
  // A Vercel chama a rotina pelo endereço interno do deploy; o link do
  // e-mail precisa do domínio de produção, que ela expõe nesta variável.
  const dominioProducao = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const urlSistema = dominioProducao ? `https://${dominioProducao}` : request.nextUrl.origin
  const email = montarEmailLembrete(grupos, loja?.nome || 'Sistema da Loja', urlSistema)

  const resultados = await Promise.allSettled(emails.map((para) => enviarEmail({ para, ...email })))
  const falhas = resultados.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
  for (const falha of falhas) {
    console.error('Falha ao enviar lembrete de contas:', falha.reason)
  }

  if (falhas.length === emails.length) {
    // Ninguém recebeu: libera o dia para a rotina poder tentar de novo.
    await supabaseAdmin.from('lembretes_contas_envios').delete().eq('data', hoje)
    return NextResponse.json({ erro: 'Nenhum e-mail pôde ser enviado.' }, { status: 502 })
  }

  return NextResponse.json({ enviado: true, destinatarios: emails.length - falhas.length, falhas: falhas.length, contas: totalContas })
}
