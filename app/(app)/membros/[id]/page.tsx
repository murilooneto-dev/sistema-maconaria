import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { MembroDetalhe } from './MembroDetalhe'
import { AnexosMembro } from '@/components/anexos/AnexosMembro'

export default async function MembroDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'ADMINISTRADOR'
  const podeGerenciarAnexos = profile?.role === 'ADMINISTRADOR' || profile?.role === 'TESOUREIRO'

  const { data: membro, error } = await supabase
    .from('membros')
    .select(
      'id, nome, telefone, matricula, do_quadro, remido, recolhe, em_iniciacao, situacao, data_cadastro, observacao'
    )
    .eq('id', id)
    .single()

  if (error || !membro) {
    notFound()
  }

  const { data: anexos } = await supabase
    .from('anexos')
    .select('id, nome_arquivo, tamanho_bytes, criado_em')
    .eq('entidade_tipo', 'MEMBRO')
    .eq('entidade_id', id)
    .eq('status', 'ATIVO')
    .order('criado_em', { ascending: false })

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">{membro.nome}</h1>
      <MembroDetalhe membro={membro} isAdmin={isAdmin} />
      <AnexosMembro membroId={id} anexos={anexos ?? []} podeGerenciar={podeGerenciarAnexos} />
    </div>
  )
}
