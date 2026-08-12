import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buscarRelatorioMembros } from '@/lib/relatorios/membros'
import { gerarCsv } from '@/lib/csv'

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

  const csv = gerarCsv(resultado.colunas, resultado.linhas)
  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="relatorio-membros.csv"' },
  })
}
