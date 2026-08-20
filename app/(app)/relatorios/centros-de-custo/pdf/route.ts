import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buscarDadosCentrosDeCusto } from '@/lib/relatorios/centros-de-custo'
import {
  filtrarCentroDeCusto,
  detalharCentrosDeCusto,
  centrosDeCustoParaResultado,
} from '@/lib/relatorios/centros-de-custo-relatorio'
import { gerarPdfTabela } from '@/lib/pdf/tabela'
import { buscarCabecalhoLoja } from '@/lib/pdf/cabecalho-loja'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dados = await buscarDadosCentrosDeCusto(supabase, {
    dataInicio: searchParams.get('dataInicio') ?? undefined,
    dataFim: searchParams.get('dataFim') ?? undefined,
  })
  const filtrados = filtrarCentroDeCusto(dados, searchParams.get('centroDeCustoId') ?? undefined)
  const resultado = centrosDeCustoParaResultado(detalharCentrosDeCusto(filtrados))

  const cabecalho = await buscarCabecalhoLoja(supabase)
  const pdfBytes = await gerarPdfTabela({ ...resultado, lojaNome: cabecalho.nome, logo: cabecalho.logo })
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="relatorio-centros-de-custo.pdf"',
    },
  })
}
