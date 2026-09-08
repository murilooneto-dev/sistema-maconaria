'use server'

import { revalidatePath } from 'next/cache'
import { requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { validarGeracaoRecibo } from '@/lib/domain/recibos'

type ActionState = { error: string } | { success: string; reciboId: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function gerarRecibo(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const tipo = String(formData.get('tipo') ?? '')
  const pagamentoId = String(formData.get('pagamentoId') ?? '') || null
  const doacaoId = String(formData.get('doacaoId') ?? '') || null
  const movimentacaoId = String(formData.get('movimentacaoId') ?? '') || null
  const pessoaInformada = String(formData.get('pessoa') ?? '').trim() || null
  const referenciaInformada = String(formData.get('referencia') ?? '').trim() || null
  const descricao = String(formData.get('descricao') ?? '').trim() || null

  const validacao = validarGeracaoRecibo({
    tipo,
    pagamentoId,
    doacaoId,
    movimentacaoId,
    pessoa: pessoaInformada,
  })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  let pessoa: string
  let membroId: string | null
  let valor: number
  let referencia: string
  let data: string

  if (tipo === 'MENSALIDADE') {
    const { data: pagamento, error: pagamentoError } = await supabaseAdmin
      .from('pagamentos')
      .select('id, membro_id, valor_total, data_pagamento, status, membros(nome)')
      .eq('id', pagamentoId)
      .single()

    if (pagamentoError || !pagamento) {
      return { error: 'Pagamento não encontrado.' }
    }
    if (pagamento.status !== 'ATIVO') {
      return { error: 'Este pagamento está cancelado — não é possível gerar recibo.' }
    }

    const { data: vinculos } = await supabaseAdmin
      .from('pagamento_mensalidades')
      .select('mensalidades(ano, mes)')
      .eq('pagamento_id', pagamentoId)

    const competencias = (vinculos ?? [])
      .map((v) => {
        const m = Array.isArray(v.mensalidades) ? v.mensalidades[0] : v.mensalidades
        return m ? `${String(m.mes).padStart(2, '0')}/${m.ano}` : null
      })
      .filter((c): c is string => Boolean(c))

    const membro = Array.isArray(pagamento.membros) ? pagamento.membros[0] : pagamento.membros
    pessoa = membro?.nome ?? 'Membro'
    membroId = pagamento.membro_id
    valor = Number(pagamento.valor_total)
    referencia = competencias.length > 0 ? `mensalidade(s) ${competencias.join(', ')}` : 'mensalidade'
    data = pagamento.data_pagamento
  } else if (tipo === 'CAMPANHA') {
    const { data: doacao, error: doacaoError } = await supabaseAdmin
      .from('doacoes')
      .select('id, doador, membro_id, valor, data, status, campanhas(titulo)')
      .eq('id', doacaoId)
      .single()

    if (doacaoError || !doacao) {
      return { error: 'Doação não encontrada.' }
    }
    if (doacao.status !== 'ATIVO') {
      return { error: 'Esta doação está cancelada — não é possível gerar recibo.' }
    }

    const campanha = Array.isArray(doacao.campanhas) ? doacao.campanhas[0] : doacao.campanhas
    pessoa = doacao.doador
    membroId = doacao.membro_id
    valor = Number(doacao.valor)
    referencia = campanha?.titulo ?? 'campanha'
    data = doacao.data
  } else {
    const { data: movimentacao, error: movimentacaoError } = await supabaseAdmin
      .from('movimentacoes')
      .select('id, membro_id, valor, data, tipo, status, categorias_movimentacao(nome)')
      .eq('id', movimentacaoId)
      .single()

    if (movimentacaoError || !movimentacao) {
      return { error: 'Movimentação não encontrada.' }
    }
    if (movimentacao.tipo !== 'ENTRADA') {
      return { error: 'Só é possível gerar recibo para uma entrada de dinheiro.' }
    }
    if (movimentacao.status !== 'ATIVO') {
      return { error: 'Esta movimentação está cancelada — não é possível gerar recibo.' }
    }

    const categoria = Array.isArray(movimentacao.categorias_movimentacao)
      ? movimentacao.categorias_movimentacao[0]
      : movimentacao.categorias_movimentacao

    pessoa = pessoaInformada as string
    membroId = movimentacao.membro_id
    valor = Number(movimentacao.valor)
    referencia = referenciaInformada ?? categoria?.nome ?? 'movimentação financeira'
    data = movimentacao.data
  }

  const { data: lojaConfig } = await supabaseAdmin
    .from('loja_config')
    .select('assinatura_url, assinatura_tesoureiro_url')
    .eq('id', 1)
    .single()

  const { data: recibo, error } = await supabaseAdmin
    .from('recibos')
    .insert({
      tipo,
      membro_id: membroId,
      pessoa,
      valor,
      referencia,
      data,
      descricao,
      assinatura_url: lojaConfig?.assinatura_url ?? null,
      assinatura_tesoureiro_url: lojaConfig?.assinatura_tesoureiro_url ?? null,
      usuario_id: usuario.id,
      pagamento_id: tipo === 'MENSALIDADE' ? pagamentoId : null,
      doacao_id: tipo === 'CAMPANHA' ? doacaoId : null,
      movimentacao_id: tipo === 'MOVIMENTACAO' ? movimentacaoId : null,
    })
    .select('id')
    .single()

  if (error || !recibo) {
    return { error: `Falha ao gerar recibo: ${error?.message ?? 'erro desconhecido'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'recibos',
      acao: 'GERACAO_RECIBO',
      registroTabela: 'recibos',
      registroId: recibo.id,
      dadosNovos: { tipo, pessoa, valor, referencia, data },
      descricao: `Recibo de ${
        tipo === 'MENSALIDADE' ? 'mensalidade' : tipo === 'CAMPANHA' ? 'campanha' : 'movimentação'
      } para ${pessoa}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (recibo gerado com sucesso):', auditError)
  }

  revalidatePath('/recibos')
  return { success: 'Recibo gerado com sucesso.', reciboId: recibo.id }
}
