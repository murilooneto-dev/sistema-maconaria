import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buscarBalancete, balanceteParaResultado } from '@/lib/relatorios/balancete'
import { gerarCsv } from '@/lib/csv'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const balancete = await buscarBalancete(supabase, {
    dataInicio: searchParams.get('dataInicio') ?? undefined,
    dataFim: searchParams.get('dataFim') ?? undefined,
  })
  const resultado = balanceteParaResultado(balancete)

  const csv = gerarCsv(resultado.colunas, resultado.linhas)
  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="balancete-financeiro.csv"' },
  })
}
