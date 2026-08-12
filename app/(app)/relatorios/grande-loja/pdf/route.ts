import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buscarRelatorioGrandeLoja } from '@/lib/relatorios/grande-loja'
import { gerarPdfTabela } from '@/lib/pdf/tabela'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const resultado = await buscarRelatorioGrandeLoja(supabase, {
    ano: searchParams.get('ano') ?? undefined,
    mes: searchParams.get('mes') ?? undefined,
    status: searchParams.get('status') ?? undefined,
  })

  const pdfBytes = await gerarPdfTabela(resultado)
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="relatorio-grande-loja.pdf"' },
  })
}
