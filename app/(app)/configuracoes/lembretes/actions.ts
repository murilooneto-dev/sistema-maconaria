'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { parseEmailsLembrete } from '@/lib/domain/contas-pagar-receber'

type ActionState = { error: string } | { success: string } | undefined

export async function salvarEmailsLembrete(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: err instanceof AuthorizationError ? err.message : 'Não autorizado.' }
  }

  const resultado = parseEmailsLembrete(String(formData.get('emails') ?? ''))
  if (!resultado.valido) {
    return { error: resultado.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anterior } = await supabaseAdmin
    .from('loja_config')
    .select('emails_lembrete_contas')
    .eq('id', 1)
    .maybeSingle()

  const { error } = await supabaseAdmin
    .from('loja_config')
    .update({ emails_lembrete_contas: resultado.emails })
    .eq('id', 1)

  if (error) {
    return { error: `Falha ao salvar: ${error.message}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'ALTERACAO_EMAILS_LEMBRETE',
      registroTabela: 'loja_config',
      dadosAnteriores: { emails: anterior?.emails_lembrete_contas ?? [] },
      dadosNovos: { emails: resultado.emails },
      descricao: 'Alteração dos e-mails que recebem o lembrete de contas a pagar e a receber',
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (e-mails do lembrete salvos):', auditError)
  }

  revalidatePath('/configuracoes/lembretes')
  return {
    success:
      resultado.emails.length > 0
        ? `Salvo. O lembrete vai para ${resultado.emails.length} e-mail(s).`
        : 'Salvo. Sem e-mails definidos, o lembrete vai para os Administradores e Tesoureiros.',
  }
}
