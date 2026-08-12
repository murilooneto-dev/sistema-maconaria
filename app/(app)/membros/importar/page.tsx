import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { ImportarCsvForm } from './ImportarCsvForm'

export default async function ImportarMembrosPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMINISTRADOR') {
    return <AcessoNegado />
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Importar membros via CSV</h1>

      <div className="max-w-2xl space-y-2 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Formato esperado</p>
        <p>
          Arquivo <code className="rounded bg-slate-100 px-1">.csv</code> com separador <code className="rounded bg-slate-100 px-1">;</code> e cabeçalho na primeira linha. Coluna obrigatória: <strong>nome</strong>. Colunas opcionais: <strong>matricula</strong> (deixe em branco para membros em iniciação), <strong>telefone</strong>, <strong>doQuadro</strong>, <strong>remido</strong>, <strong>recolhe</strong>, <strong>emIniciacao</strong> (use Sim/Não — se omitidas, doQuadro assume Sim e as demais Não).
        </p>
        <p className="text-xs text-slate-500">
          Exemplo: <code className="rounded bg-slate-100 px-1">nome;matricula;telefone;doQuadro;remido;recolhe;emIniciacao</code>
          <br />
          <code className="rounded bg-slate-100 px-1">João da Silva;1234;(11) 99999-0000;Sim;Não;Não;Não</code>
          <br />
          <code className="rounded bg-slate-100 px-1">Maria Souza;;(11) 98888-0000;Não;Não;Não;Sim</code>
        </p>
        <p className="text-xs text-slate-500">
          Membros com <strong>doQuadro = Sim</strong> têm as competências de mensalidade geradas automaticamente, igual ao cadastro manual. Matrículas duplicadas são ignoradas (a linha é reportada, mas o membro existente não é alterado).
        </p>
      </div>

      <ImportarCsvForm />
    </div>
  )
}
