import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'

export type RegistrarAuditoriaInput = {
  usuarioId: string
  modulo: string
  acao: string
  registroTabela?: string
  registroId?: string
  dadosAnteriores?: Record<string, unknown> | null
  dadosNovos?: Record<string, unknown> | null
  descricao?: string
}

/**
 * Grava uma linha de auditoria via service_role (a tabela `auditoria` não
 * tem policy de INSERT para clientes — escrita é sempre server-side).
 * Lança erro se a gravação falhar; ver decisão técnica 2 do plano da Fase 3
 * sobre por que a operação principal que chamou isto não é revertida.
 */
export async function registrarAuditoria(input: RegistrarAuditoriaInput): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()

  const { error } = await supabase.from('auditoria').insert({
    usuario_id: input.usuarioId,
    modulo: input.modulo,
    acao: input.acao,
    registro_tabela: input.registroTabela ?? null,
    registro_id: input.registroId ?? null,
    dados_anteriores: input.dadosAnteriores ?? null,
    dados_novos: input.dadosNovos ?? null,
    descricao: input.descricao ?? null,
  })

  if (error) {
    throw new Error(`Falha ao registrar auditoria: ${error.message}`)
  }
}
