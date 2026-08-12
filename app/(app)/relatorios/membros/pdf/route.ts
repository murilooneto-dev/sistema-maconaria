import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buscarRelatorioMembros } from '@/lib/relatorios/membros'
import { gerarPdfTabela } from '@/lib/pdf/tabela'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const resultado = await buscarRelatorioMembros(supabase, {
    situacao: searchParams.get('situacao') ?? undefined,
    doQuadro: searchParams.get('doQuadro') ?? undefined,
    remido: searchParams.get('remido') ?? undefined,
  })

  const pdfBytes = await gerarPdfTabela(resultado)
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="relatorio-membros.pdf"' },
  })
}
