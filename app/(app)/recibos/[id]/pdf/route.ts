import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { gerarPdfRecibo } from '@/lib/pdf/recibo'
import { buscarImagemStorage } from '@/lib/pdf/imagens'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: recibo, error } = await supabaseAdmin.from('recibos').select('*').eq('id', id).single()

  if (error || !recibo) {
    return NextResponse.json({ error: 'Recibo não encontrado.' }, { status: 404 })
  }

  const { data: lojaConfig } = await supabaseAdmin.from('loja_config').select('nome, logo_url').eq('id', 1).single()

  const [logo, assinatura, assinaturaTesoureiro] = await Promise.all([
    buscarImagemStorage(supabaseAdmin, 'loja-assets', lojaConfig?.logo_url ?? null),
    buscarImagemStorage(supabaseAdmin, 'loja-assinaturas', recibo.assinatura_url),
    buscarImagemStorage(supabaseAdmin, 'loja-assinaturas', recibo.assinatura_tesoureiro_url),
  ])

  const pdfBytes = await gerarPdfRecibo({
    id: recibo.id,
    tipo: recibo.tipo,
    pessoa: recibo.pessoa,
    valor: Number(recibo.valor),
    referencia: recibo.referencia,
    data: recibo.data,
    descricao: recibo.descricao,
    lojaNome: lojaConfig?.nome ?? 'Loja Maçônica',
    logo,
    assinatura,
    assinaturaTesoureiro,
  })

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="recibo-${recibo.id}.pdf"`,
    },
  })
}
