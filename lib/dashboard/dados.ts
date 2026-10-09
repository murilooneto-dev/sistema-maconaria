import type { createSupabaseServerClient } from '@/lib/supabase/server'
import { calcularSaldoConta } from '@/lib/domain/financeiro'
import { calcularArrecadado, calcularPercentual } from '@/lib/domain/campanhas'
import { contarCompetenciasVencidasNaoPagas } from '@/lib/domain/inadimplencia'
import { abreviarMes } from '@/lib/format'
import { competenciaAtual, hojeISO, primeiroDiaMesAtual } from '@/lib/datas'
import { buscarTodos } from '@/lib/supabase/buscar-todos'
import { buscarTotaisDaConta } from '@/lib/relatorios/saldos'

export type FiltrosDashboard = { dataInicio?: string; dataFim?: string }

export type DadosDashboard = {
  periodo: { dataInicio: string; dataFim: string }
  totalMembros: number
  ativos: number
  inativos: number
  inadimplentes: number
  entradasPeriodo: number
  saidasPeriodo: number
  saldoConsolidado: number
  saldosPorConta: { nome: string; saldo: number }[]
  campanhasEmAndamento: { id: string; titulo: string; meta: number; arrecadado: number; percentual: number }[]
  ultimasMovimentacoes: { id: string; data: string; tipo: string; categoria: string; valor: number }[]
  graficoMensal: { mesLabel: string; entradas: number; saidas: number }[]
}

function nome(rel: { nome: string }[] | { nome: string } | null): string {
  if (!rel) return '-'
  return Array.isArray(rel) ? (rel[0]?.nome ?? '-') : rel.nome
}

export async function buscarDadosDashboard(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filtros: FiltrosDashboard
): Promise<DadosDashboard> {
  const dataInicio = filtros.dataInicio || primeiroDiaMesAtual()
  const dataFim = filtros.dataFim || hojeISO()

  // --- Membros ---
  const { data: membros } = await supabase.from('membros').select('id, situacao').eq('do_quadro', true)
  const totalMembros = membros?.length ?? 0
  const ativos = (membros ?? []).filter((m) => m.situacao === 'ATIVO').length
  const inativos = totalMembros - ativos

  const membroIds = (membros ?? []).map((m) => m.id)
  const { data: mensalidadesMembros } =
    membroIds.length > 0
      ? await buscarTodos((de, ate) =>
          supabase
            .from('mensalidades')
            .select('membro_id, ano, mes, status')
            .in('membro_id', membroIds)
            .order('id')
            .range(de, ate)
        )
      : { data: [] as { membro_id: string; ano: number; mes: number; status: string }[] }

  const hojeCompetencia = competenciaAtual()
  const inadimplentes = membroIds.filter((id) => {
    const doMembro = (mensalidadesMembros ?? []).filter((m) => m.membro_id === id)
    return contarCompetenciasVencidasNaoPagas(doMembro, hojeCompetencia) > 0
  }).length

  // --- Entradas/saídas do período ---
  const { data: movimentacoesPeriodo } = await buscarTodos((de, ate) =>
    supabase
      .from('movimentacoes')
      .select('tipo, valor')
      .eq('status', 'ATIVO')
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('id')
      .range(de, ate)
  )

  const entradasPeriodo = (movimentacoesPeriodo ?? [])
    .filter((m) => m.tipo === 'ENTRADA')
    .reduce((s, m) => s + Number(m.valor), 0)
  const saidasPeriodo = (movimentacoesPeriodo ?? [])
    .filter((m) => m.tipo === 'SAIDA')
    .reduce((s, m) => s + Number(m.valor), 0)

  // --- Saldos por conta ---
  const { data: contas } = await supabase.from('contas').select('id, nome, saldo_inicial').order('nome')
  const saldosPorConta: { nome: string; saldo: number }[] = []
  let saldoConsolidado = 0

  for (const conta of contas ?? []) {
    const saldo = calcularSaldoConta({
      saldoInicial: Number(conta.saldo_inicial),
      ...(await buscarTotaisDaConta(supabase, conta.id)),
    })
    saldosPorConta.push({ nome: conta.nome, saldo })
    saldoConsolidado += saldo
  }

  // --- Campanhas em andamento ---
  const { data: campanhas } = await supabase
    .from('campanhas')
    .select('id, titulo, meta, doacoes(valor, status)')
    .eq('status', 'EM_ANDAMENTO')
    .order('created_at', { ascending: false })

  const campanhasEmAndamento = (campanhas ?? []).map((c) => {
    const ativas = (c.doacoes ?? []).filter((d: { status: string }) => d.status === 'ATIVO')
    const arrecadado = calcularArrecadado(ativas)
    const meta = Number(c.meta)
    return { id: c.id, titulo: c.titulo, meta, arrecadado, percentual: calcularPercentual(arrecadado, meta) }
  })

  // --- Últimas movimentações ---
  const { data: ultimas } = await supabase
    .from('movimentacoes')
    .select('id, data, tipo, valor, categorias_movimentacao(nome)')
    .eq('status', 'ATIVO')
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(8)

  const ultimasMovimentacoes = (ultimas ?? []).map((m) => ({
    id: m.id,
    data: m.data,
    tipo: m.tipo,
    categoria: nome(m.categorias_movimentacao),
    valor: Number(m.valor),
  }))

  // --- Gráfico entradas x saídas (últimos 6 meses, fixo, independente do filtro de período) ---
  const meses: { ano: number; mes: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(hojeCompetencia.ano, hojeCompetencia.mes - 1 - i, 1))
    meses.push({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 })
  }
  const inicioGrafico = `${meses[0].ano}-${String(meses[0].mes).padStart(2, '0')}-01`

  const { data: movimentacoesGrafico } = await buscarTodos((de, ate) =>
    supabase
      .from('movimentacoes')
      .select('data, tipo, valor')
      .eq('status', 'ATIVO')
      .gte('data', inicioGrafico)
      .order('id')
      .range(de, ate)
  )

  const graficoMensal = meses.map(({ ano, mes }) => {
    const doMes = (movimentacoesGrafico ?? []).filter((m) => {
      const [a, mm] = m.data.split('-').map(Number)
      return a === ano && mm === mes
    })
    return {
      mesLabel: abreviarMes(mes),
      entradas: doMes.filter((m) => m.tipo === 'ENTRADA').reduce((s, m) => s + Number(m.valor), 0),
      saidas: doMes.filter((m) => m.tipo === 'SAIDA').reduce((s, m) => s + Number(m.valor), 0),
    }
  })

  return {
    periodo: { dataInicio, dataFim },
    totalMembros,
    ativos,
    inativos,
    inadimplentes,
    entradasPeriodo,
    saidasPeriodo,
    saldoConsolidado,
    saldosPorConta,
    campanhasEmAndamento,
    ultimasMovimentacoes,
    graficoMensal,
  }
}
