import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buscarRelatorioFinanceiro } from '@/lib/relatorios/financeiro'
import { gerarPdfTabela } from '@/lib/pdf/tabela'
import { buscarCabecalhoLoja } from '@/lib/pdf/cabecalho-loja'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const resultado = await buscarRelatorioFinanceiro(supabase, {
    dataInicio: searchParams.get('dataInicio') ?? undefined,
    dataFim: searchParams.get('dataFim') ?? undefined,
    tipo: searchParams.get('tipo') ?? undefined,
    categoriaId: searchParams.get('categoriaId') ?? undefined,
    contaId: searchParams.get('contaId') ?? undefined,
    formaPagamentoId: searchParams.get('formaPagamentoId') ?? undefined,
    membroId: searchParams.get('membroId') ?? undefined,
    campanhaId: searchParams.get('campanhaId') ?? undefined,
  })

  const cabecalho = await buscarCabecalhoLoja(supabase)
  const pdfBytes = await gerarPdfTabela({ ...resultado, lojaNome: cabecalho.nome, logo: cabecalho.logo })
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="relatorio-financeiro.pdf"' },
  })
}
