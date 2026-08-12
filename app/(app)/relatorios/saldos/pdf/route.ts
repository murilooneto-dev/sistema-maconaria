import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buscarRelatorioSaldos } from '@/lib/relatorios/saldos'
import { gerarPdfTabela } from '@/lib/pdf/tabela'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const resultado = await buscarRelatorioSaldos(supabase)
  const pdfBytes = await gerarPdfTabela(resultado)
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="relatorio-saldos.pdf"' },
  })
}
