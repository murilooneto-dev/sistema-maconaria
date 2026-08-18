import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { AcessoNegado } from '@/components/AcessoNegado'
import { FinanceiroTabs } from '../FinanceiroTabs'
import { calcularFechamento } from '@/lib/domain/financeiro'
import {
  calcularSaldoInicialSemHistorico,
  calcularTotaisPeriodo,
  obterRegistroPeriodo,
  obterUltimoFechado,
} from '@/lib/financeiro/fechamento'
import { FecharPeriodoButton } from './FecharPeriodoButton'
import { HistoricoFechamentos } from './HistoricoFechamentos'
import { formatarMoedaBR } from '@/lib/format'

function proximoMes(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 }
}

export default async function FechamentoPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'ADMINISTRADOR'
  const podeFechar = isAdmin || profile?.role === 'TESOUREIRO'

  if (!podeFechar) {
    return <AcessoNegado />
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const ultimoFechado = await obterUltimoFechado(supabaseAdmin)
  const hoje = new Date()
  const candidatoPadrao = ultimoFechado
    ? proximoMes(ultimoFechado.ano, ultimoFechado.mes)
    : { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 }

  const registroExistente = await obterRegistroPeriodo(supabaseAdmin, candidatoPadrao.ano, candidatoPadrao.mes)
  const candidato =
    registroExistente && registroExistente.status === 'ABERTO'
      ? { ano: registroExistente.ano, mes: registroExistente.mes }
      : candidatoPadrao

  const saldoInicial =
    registroExistente && registroExistente.status === 'ABERTO'
      ? Number(registroExistente.saldo_inicial)
      : ultimoFechado
        ? Number(ultimoFechado.saldo_final)
        : await calcularSaldoInicialSemHistorico(supabaseAdmin, candidato.ano, candidato.mes)

  const { totalEntradas, totalSaidas, totalTransferencias } = await calcularTotaisPeriodo(
    supabaseAdmin,
    candidato.ano,
    candidato.mes
  )
  const saldoFinal = calcularFechamento({ saldoInicial, totalEntradas, totalSaidas })

  const { data: historico } = await supabase
    .from('fechamentos_mensais')
    .select('*')
    .order('ano', { ascending: false })
    .order('mes', { ascending: false })

  const maisRecenteFechado =
    (historico ?? []).find((f) => f.status === 'FECHADO') ?? null

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Financeiro</h1>
      <FinanceiroTabs />

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">
          Período {String(candidato.mes).padStart(2, '0')}/{candidato.ano}
          {registroExistente?.status === 'ABERTO' && (
            <span className="ml-2 text-xs font-normal text-amber-600">(reaberto — pendente de re-fechamento)</span>
          )}
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <dt className="text-xs text-slate-500">Saldo inicial</dt>
            <dd className="text-lg font-semibold text-slate-900">{formatarMoedaBR(saldoInicial)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Entradas</dt>
            <dd className="text-lg font-semibold text-green-700">{formatarMoedaBR(totalEntradas)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Saídas</dt>
            <dd className="text-lg font-semibold text-red-700">{formatarMoedaBR(totalSaidas)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Transferências (volume)</dt>
            <dd className="text-lg font-semibold text-slate-900">{formatarMoedaBR(totalTransferencias)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Saldo final</dt>
            <dd className="text-lg font-semibold text-slate-900">{formatarMoedaBR(saldoFinal)}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <FecharPeriodoButton ano={candidato.ano} mes={candidato.mes} />
        </div>
      </div>

      <HistoricoFechamentos
        historico={historico ?? []}
        maisRecenteFechadoId={maisRecenteFechado?.id ?? null}
        isAdmin={isAdmin}
      />
    </div>
  )
}
