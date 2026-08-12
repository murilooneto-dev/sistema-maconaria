'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { parseCsvMembros } from '@/lib/domain/membros-import'
import { gerarCompetenciasParaMembro } from '@/lib/mensalidades/gerar-competencias-membro'

export type ResultadoImportacao = {
  error?: string
  resumo?: {
    total: number
    criados: number
    duplicados: { linha: number; matricula: string | null }[]
    invalidos: { linha: number; erro: string }[]
    falhas: { linha: number; erro: string }[]
  }
}

export async function importarMembros(
  _prevState: ResultadoImportacao | undefined,
  formData: FormData
): Promise<ResultadoImportacao> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: err instanceof AuthorizationError ? err.message : 'Não autorizado.' }
  }

  const arquivo = formData.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { error: 'Selecione um arquivo CSV.' }
  }

  const conteudo = await arquivo.text()
  const { linhas, erroCabecalho } = parseCsvMembros(conteudo)

  if (erroCabecalho) {
    return { error: erroCabecalho }
  }
  if (linhas.length === 0) {
    return { error: 'Nenhuma linha encontrada no arquivo.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const invalidos = linhas.filter((l) => l.erro).map((l) => ({ linha: l.numeroLinha, erro: l.erro! }))
  const duplicados: { linha: number; matricula: string | null }[] = []
  const falhas: { linha: number; erro: string }[] = []
  let criados = 0

  for (const linha of linhas) {
    if (linha.erro) continue

    const { data: criado, error } = await supabaseAdmin
      .from('membros')
      .insert({
        nome: linha.nome,
        matricula: linha.matricula,
        telefone: linha.telefone,
        do_quadro: linha.doQuadro,
        remido: linha.remido,
        recolhe: linha.recolhe,
        em_iniciacao: linha.emIniciacao,
      })
      .select('id, data_cadastro')
      .single()

    if (error || !criado) {
      if (error?.code === '23505') {
        duplicados.push({ linha: linha.numeroLinha, matricula: linha.matricula })
      } else {
        falhas.push({ linha: linha.numeroLinha, erro: error?.message ?? 'erro desconhecido' })
      }
      continue
    }

    criados += 1

    if (linha.doQuadro) {
      try {
        await gerarCompetenciasParaMembro(supabaseAdmin, {
          id: criado.id,
          remido: linha.remido,
          data_cadastro: criado.data_cadastro,
        })
      } catch (geracaoError) {
        console.error(`Falha ao gerar competências para o membro importado ${criado.id}:`, geracaoError)
      }
    }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'membros',
      acao: 'IMPORTACAO_CSV',
      registroTabela: 'membros',
      dadosNovos: {
        total: linhas.length,
        criados,
        duplicados: duplicados.length,
        invalidos: invalidos.length,
        falhas: falhas.length,
      },
      descricao: `Importação de membros via CSV: ${criados} criado(s) de ${linhas.length} linha(s)`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (importação de membros):', auditError)
  }

  revalidatePath('/membros')
  revalidatePath('/mensalidades')

  return {
    resumo: { total: linhas.length, criados, duplicados, invalidos, falhas },
  }
}
