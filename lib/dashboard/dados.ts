import type { createSupabaseServerClient } from '@/lib/supabase/server'
import { calcularSaldoConta } from '@/lib/domain/financeiro'
import { calcularArrecadado, calcularPercentual } from '@/lib/domain/campanhas'
import { contarCompetenciasVencidasNaoPagas } from '@/lib/domain/inadimplencia'
import { abreviarMes } from '@/lib/format'

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

function primeiroDiaMesAtual(): string {
  const hoje = new Date()
  return `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
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
      ? await supabase.from('mensalidades').select('membro_id, ano, mes, status').in('membro_id', membroIds)
      : { data: [] as { membro_id: string; ano: number; mes: number; status: string }[] }

  const hojeCompetencia = { ano: new Date().getUTCFullYear(), mes: new Date().getUTCMonth() + 1 }
  const inadimplentes = membroIds.filter((id) => {
    const doMembro = (mensalidadesMembros ?? []).filter((m) => m.membro_id === id)
    return contarCompetenciasVencidasNaoPagas(doMembro, hojeCompetencia) > 0
  }).length

  // --- Entradas/saídas do período ---
  const { data: movimentacoesPeriodo } = await supabase
    .from('movimentacoes')
    .select('tipo, valor')
    .eq('status', 'ATIVO')
    .gte('data', dataInicio)
    .lte('data', dataFim)

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
    const [entradas, saidas, transfSaida, transfEntrada] = await Promise.all([
      supabase.from('movimentacoes').select('valor').eq('conta_id', conta.id).eq('tipo', 'ENTRADA').eq('status', 'ATIVO'),
      supabase.from('movimentacoes').select('valor').eq('conta_id', conta.id).eq('tipo', 'SAIDA').eq('status', 'ATIVO'),
      supabase.from('transferencias').select('valor').eq('conta_origem_id', conta.id).eq('status', 'ATIVO'),
      supabase.from('transferencias').select('valor').eq('conta_destino_id', conta.id).eq('status', 'ATIVO'),
    ])

    const saldo = calcularSaldoConta({
      saldoInicial: Number(conta.saldo_inicial),
      totalEntradas: (entradas.data ?? []).reduce((s, m) => s + Number(m.valor), 0),
      totalSaidas: (saidas.data ?? []).reduce((s, m) => s + Number(m.valor), 0),
      totalTransferenciasSaida: (transfSaida.data ?? []).reduce((s, t) => s + Number(t.valor), 0),
      totalTransferenciasEntrada: (transfEntrada.data ?? []).reduce((s, t) => s + Number(t.valor), 0),
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
  const hoje = new Date()
  const meses: { ano: number; mes: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1))
    meses.push({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 })
  }
  const inicioGrafico = `${meses[0].ano}-${String(meses[0].mes).padStart(2, '0')}-01`

  const { data: movimentacoesGrafico } = await supabase
    .from('movimentacoes')
    .select('data, tipo, valor')
    .eq('status', 'ATIVO')
    .gte('data', inicioGrafico)

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
