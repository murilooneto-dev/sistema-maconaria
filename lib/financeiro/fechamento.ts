import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { buscarTodos } from '@/lib/supabase/buscar-todos'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function primeiroDia(ano: number, mes: number): string {
  return `${ano}-${pad(mes)}-01`
}

function primeiroDiaProximoMes(ano: number, mes: number): string {
  return mes === 12 ? `${ano + 1}-01-01` : `${ano}-${pad(mes + 1)}-01`
}

export type Fechamento = {
  id: string
  ano: number
  mes: number
  saldo_inicial: number
  total_entradas: number
  total_saidas: number
  total_transferencias: number
  saldo_final: number
  status: string
}

export async function obterUltimoFechado(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>
): Promise<Fechamento | null> {
  const { data } = await supabaseAdmin
    .from('fechamentos_mensais')
    .select('*')
    .eq('status', 'FECHADO')
    .order('ano', { ascending: false })
    .order('mes', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function obterRegistroPeriodo(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  ano: number,
  mes: number
): Promise<Fechamento | null> {
  const { data } = await supabaseAdmin
    .from('fechamentos_mensais')
    .select('*')
    .eq('ano', ano)
    .eq('mes', mes)
    .maybeSingle()
  return data
}

/** Saldo consolidado de todas as contas até o dia anterior ao início do período, usado só quando não há fechamento anterior. */
export async function calcularSaldoInicialSemHistorico(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  ano: number,
  mes: number
): Promise<number> {
  const limite = primeiroDia(ano, mes)

  const { data: contas } = await supabaseAdmin.from('contas').select('saldo_inicial')
  const somaSaldoInicial = (contas ?? []).reduce((s, c) => s + Number(c.saldo_inicial), 0)

  const { data: movimentacoes } = await buscarTodos((de, ate) =>
    supabaseAdmin
      .from('movimentacoes')
      .select('tipo, valor')
      .eq('status', 'ATIVO')
      .lt('data', limite)
      .order('id')
      .range(de, ate)
  )

  const somaMovimentacoes = (movimentacoes ?? []).reduce(
    (s, m) => s + (m.tipo === 'ENTRADA' ? Number(m.valor) : -Number(m.valor)),
    0
  )

  return somaSaldoInicial + somaMovimentacoes
}

export async function calcularTotaisPeriodo(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  ano: number,
  mes: number
): Promise<{ totalEntradas: number; totalSaidas: number; totalTransferencias: number }> {
  const inicio = primeiroDia(ano, mes)
  const fim = primeiroDiaProximoMes(ano, mes)

  const { data: movimentacoes } = await buscarTodos((de, ate) =>
    supabaseAdmin
      .from('movimentacoes')
      .select('tipo, valor')
      .eq('status', 'ATIVO')
      .gte('data', inicio)
      .lt('data', fim)
      .order('id')
      .range(de, ate)
  )

  const totalEntradas = (movimentacoes ?? [])
    .filter((m) => m.tipo === 'ENTRADA')
    .reduce((s, m) => s + Number(m.valor), 0)
  const totalSaidas = (movimentacoes ?? [])
    .filter((m) => m.tipo === 'SAIDA')
    .reduce((s, m) => s + Number(m.valor), 0)

  const { data: transferencias } = await buscarTodos((de, ate) =>
    supabaseAdmin
      .from('transferencias')
      .select('valor')
      .eq('status', 'ATIVO')
      .gte('data', inicio)
      .lt('data', fim)
      .order('id')
      .range(de, ate)
  )

  const totalTransferencias = (transferencias ?? []).reduce((s, t) => s + Number(t.valor), 0)

  return { totalEntradas, totalSaidas, totalTransferencias }
}
