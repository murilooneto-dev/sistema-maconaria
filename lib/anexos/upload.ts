import 'server-only'
import type { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { validarArquivoAnexo } from './validar-arquivo'
import type { EntidadeTipoAnexo } from './tipos'

const BUCKET = 'anexos'

function sanitizarNomeArquivo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9.-]/g, '_') // troca qualquer coisa que não seja letra/número/ponto/hífen por _
}

type UploadResult = { error: string } | { error?: undefined; id: string }

/**
 * Sobe um arquivo pro bucket privado `anexos` e grava a linha correspondente.
 * Não lança em caso de falha — devolve { error } pro chamador decidir se é
 * fatal (o upload é sempre um passo auxiliar depois que o registro principal
 * já foi criado com sucesso).
 */
export async function uploadAnexo(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  input: {
    entidadeTipo: EntidadeTipoAnexo
    entidadeId: string
    arquivo: File
    enviadoPor: string
  }
): Promise<UploadResult> {
  const validacao = validarArquivoAnexo(input.arquivo)
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const path = `${input.entidadeTipo.toLowerCase()}/${input.entidadeId}/${Date.now()}-${sanitizarNomeArquivo(input.arquivo.name)}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, input.arquivo, { upsert: false, contentType: input.arquivo.type || undefined })

  if (uploadError) {
    return { error: `Falha ao enviar arquivo: ${uploadError.message}` }
  }

  const { data: criado, error: insertError } = await supabaseAdmin
    .from('anexos')
    .insert({
      entidade_tipo: input.entidadeTipo,
      entidade_id: input.entidadeId,
      nome_arquivo: input.arquivo.name,
      path,
      tipo_mime: input.arquivo.type || 'application/octet-stream',
      tamanho_bytes: input.arquivo.size,
      enviado_por: input.enviadoPor,
    })
    .select('id')
    .single()

  if (insertError || !criado) {
    await supabaseAdmin.storage.from(BUCKET).remove([path])
    return { error: `Falha ao registrar anexo: ${insertError?.message ?? 'erro desconhecido'}` }
  }

  return { id: criado.id }
}

/**
 * Envia todos os arquivos de um campo de formulário multi-arquivo, ignorando
 * entradas vazias (o browser manda um File(name="", size=0) quando o campo
 * fica sem seleção). Retorna quantos deram certo e as mensagens de erro dos
 * que falharam — usado por fluxos onde o upload é auxiliar e não deve
 * reverter a operação principal (pagamento/movimentação já confirmados).
 */
export async function uploadAnexosDoFormulario(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  formData: FormData,
  campo: string,
  contexto: { entidadeTipo: EntidadeTipoAnexo; entidadeId: string; enviadoPor: string }
): Promise<{ enviados: number; erros: string[] }> {
  const arquivos = formData.getAll(campo).filter((v): v is File => v instanceof File && v.size > 0)

  let enviados = 0
  const erros: string[] = []

  for (const arquivo of arquivos) {
    const resultado = await uploadAnexo(supabaseAdmin, {
      entidadeTipo: contexto.entidadeTipo,
      entidadeId: contexto.entidadeId,
      arquivo,
      enviadoPor: contexto.enviadoPor,
    })
    if (resultado.error) {
      erros.push(`${arquivo.name}: ${resultado.error}`)
    } else {
      enviados += 1
    }
  }

  return { enviados, erros }
}
