import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buscarRelatorioSaldos } from '@/lib/relatorios/saldos'
import { gerarCsv } from '@/lib/csv'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const resultado = await buscarRelatorioSaldos(supabase)
  const csv = gerarCsv(resultado.colunas, resultado.linhas)
  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="relatorio-saldos.csv"' },
  })
}
