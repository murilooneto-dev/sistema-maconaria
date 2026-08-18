import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buscarBalancete, balanceteParaResultado } from '@/lib/relatorios/balancete'
import { gerarPdfTabela } from '@/lib/pdf/tabela'
import { buscarCabecalhoLoja } from '@/lib/pdf/cabecalho-loja'

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

  const cabecalho = await buscarCabecalhoLoja(supabase)
  const pdfBytes = await gerarPdfTabela({ ...resultado, lojaNome: cabecalho.nome, logo: cabecalho.logo })
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="balancete-financeiro.pdf"' },
  })
}
