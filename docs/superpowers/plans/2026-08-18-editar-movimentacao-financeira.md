# Editar Movimentação Financeira Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar "Editar" na tabela de Movimentações do Financeiro — corrige uma movimentação lançada com erro sem perder o rastro do valor original, via cancelar+recriar (reaproveitando a lógica de cancelamento já existente e testada).

**Architecture:** Migration adiciona uma coluna de rastreabilidade (`editada_de_id`). Uma nova server action `editarMovimentacao` cria a movimentação corrigida e cancela a antiga atomicamente (mesma trava condicional já usada em `cancelarMovimentacao`), com compensação (apaga a nova) se o cancelamento da antiga falhar por concorrência. A UI reaproveita o formulário de criação (`NovaMovimentacaoForm`) em modo edição, numa rota nova `/financeiro/[id]/editar`, e a tabela de Movimentações ganha um link "Editar" ao lado do "Cancelar" já existente.

**Tech Stack:** Next.js (App Router, server actions), TypeScript, Supabase (service role para escrita), Tailwind CSS.

## Global Constraints

- Nenhuma movimentação é apagada fisicamente — "editar" cria uma nova e cancela a antiga (`status='CANCELADO'`), nunca faz `DELETE` na antiga.
- Só Tesoureiro/Administrador podem editar (`requireTesoureiro()`).
- Botão "Editar" só aparece quando `status === 'ATIVO'` e `origem !== 'MENSALIDADE'` — mesma condição já usada para "Cancelar" hoje.
- Bloqueado se o período (mês/ano) da movimentação **antiga** já estiver fechado (`periodoEstaFechado`). A data da movimentação **nova** pode cair num período fechado (mesma regra já vigente para lançamentos manuais retroativos).
- "Motivo da edição" é obrigatório.
- Toda edição gera auditoria (`registrarAuditoria`) com dados anteriores e novos.
- Anexos não são copiados automaticamente da movimentação antiga para a nova.
- Escopo apenas de `movimentacoes` avulsas (tela `/financeiro`) — pagamento de mensalidade, doação de campanha e transferência entre contas ficam de fora.

---

### Task 1: Migration — coluna `editada_de_id`

**Files:**
- Create: `supabase/migrations/00000000000028_movimentacoes_edicao.sql`

**Interfaces:**
- Consumes: nada (schema novo).
- Produces (usado pela Task 2): coluna `movimentacoes.editada_de_id` (uuid, nullable, FK para `movimentacoes(id)`), índice `movimentacoes_editada_de_idx`.

- [ ] **Step 1: Criar a migration**

```sql
-- Rastreabilidade de edição de movimentação (cancelar + recriar): a
-- movimentação nova aponta pra antiga que ela substituiu, permitindo
-- seguir a cadeia de edições diretamente por SQL/join, sem depender só de
-- parsear o texto de motivo_cancelamento.

alter table public.movimentacoes
  add column editada_de_id uuid references public.movimentacoes(id);

create index movimentacoes_editada_de_idx on public.movimentacoes (editada_de_id);
```

- [ ] **Step 2: Verificar sintaxe SQL**

Este projeto não tem Supabase CLI configurado localmente (sem `supabase/config.toml`) — as migrations são aplicadas manualmente no banco (Supabase Dashboard / SQL editor) pelo usuário, fora do fluxo automatizado. Não é possível "rodar" esta migration nesta task. Confirme visualmente que:
- O nome do arquivo segue a sequência (`00000000000028`, um a mais que `00000000000027_membros_situacao_irregular.sql`).
- A sintaxe segue o padrão dos demais arquivos em `supabase/migrations/` (ex.: `00000000000010_movimentacoes_transferencias.sql`, que já tem `foreign key` auto-referenciada em outra tabela do mesmo arquivo, e `00000000000027_membros_situacao_irregular.sql` para o estilo de comentário de cabeçalho).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00000000000028_movimentacoes_edicao.sql
git commit -m "feat: adiciona coluna editada_de_id em movimentacoes"
```

---

### Task 2: Server action `editarMovimentacao`

**Files:**
- Modify: `app/(app)/financeiro/actions.ts`

**Interfaces:**
- Consumes: `requireTesoureiro`, `AuthorizationError` de `@/lib/auth/require-role`; `createSupabaseServiceRoleClient` de `@/lib/supabase/service`; `registrarAuditoria` de `@/lib/audit`; `validarMovimentacao` de `@/lib/domain/financeiro`; `periodoEstaFechado` de `@/lib/financeiro/periodo`; `uploadAnexosDoFormulario` de `@/lib/anexos/upload`; coluna `movimentacoes.editada_de_id` (Task 1).
- Produces (usado na Task 3): `export async function editarMovimentacao(_prevState: ActionState, formData: FormData): Promise<ActionState>` — mesma assinatura de `registrarMovimentacao`, já exportada no mesmo arquivo. Campos de `formData` esperados: `movimentacaoId`, `data`, `tipo`, `categoriaId`, `descricao`, `valor`, `contaId`, `formaPagamentoId`, `membroId`, `observacao`, `motivoEdicao`, `anexos` (multi-arquivo, opcional).

- [ ] **Step 1: Implementar `editarMovimentacao` em `app/(app)/financeiro/actions.ts`**

Adicione ao final do arquivo (depois de `cancelarMovimentacao`):

```ts
export async function editarMovimentacao(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const movimentacaoId = String(formData.get('movimentacaoId') ?? '')
  const data = String(formData.get('data') ?? '')
  const tipo = String(formData.get('tipo') ?? '')
  const categoriaId = String(formData.get('categoriaId') ?? '')
  const descricao = String(formData.get('descricao') ?? '').trim()
  const valor = Number(formData.get('valor'))
  const contaId = String(formData.get('contaId') ?? '')
  const formaPagamentoId = String(formData.get('formaPagamentoId') ?? '')
  const membroId = String(formData.get('membroId') ?? '') || null
  const observacao = String(formData.get('observacao') ?? '').trim() || null
  const motivoEdicao = String(formData.get('motivoEdicao') ?? '').trim()

  if (!movimentacaoId) {
    return { error: 'Movimentação inválida.' }
  }
  if (motivoEdicao.length === 0) {
    return { error: 'Informe o motivo da edição.' }
  }

  const validacao = validarMovimentacao({ data, tipo, categoriaId, valor, contaId, formaPagamentoId })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: antiga, error: antigaError } = await supabaseAdmin
    .from('movimentacoes')
    .select('id, status, origem, data, tipo, categoria_id, descricao, valor, conta_id, forma_pagamento_id, membro_id')
    .eq('id', movimentacaoId)
    .single()

  if (antigaError || !antiga) {
    return { error: 'Movimentação não encontrada.' }
  }

  if (antiga.status !== 'ATIVO') {
    return { error: 'Esta movimentação já foi cancelada ou editada.' }
  }

  if (antiga.origem === 'MENSALIDADE') {
    return {
      error:
        'Esta movimentação é gerada automaticamente por um pagamento de mensalidade — cancele o pagamento na tela de Mensalidades.',
    }
  }

  if (await periodoEstaFechado(supabaseAdmin, antiga.data)) {
    return { error: 'Não é possível editar: o período desta movimentação já está fechado.' }
  }

  const { data: categoria } = await supabaseAdmin
    .from('categorias_movimentacao')
    .select('id, tipo, sistema, ativo')
    .eq('id', categoriaId)
    .single()

  if (!categoria || categoria.tipo !== tipo || categoria.sistema || !categoria.ativo) {
    return { error: 'Categoria inválida para este tipo de lançamento.' }
  }

  const { data: nova, error: novaError } = await supabaseAdmin
    .from('movimentacoes')
    .insert({
      data,
      tipo,
      categoria_id: categoriaId,
      descricao: descricao || null,
      valor,
      conta_id: contaId,
      forma_pagamento_id: formaPagamentoId,
      membro_id: membroId,
      usuario_id: usuario.id,
      origem: 'MANUAL',
      observacao,
      editada_de_id: antiga.id,
    })
    .select('id')
    .single()

  if (novaError || !nova) {
    return { error: `Falha ao registrar movimentação corrigida: ${novaError?.message ?? 'erro desconhecido'}` }
  }

  const { data: canceladaAntiga, error: cancelarError } = await supabaseAdmin
    .from('movimentacoes')
    .update({
      status: 'CANCELADO',
      motivo_cancelamento: `Editada — substituída pela movimentação ${nova.id}. Motivo: ${motivoEdicao}`,
      cancelado_por: usuario.id,
      cancelado_em: new Date().toISOString(),
    })
    .eq('id', antiga.id)
    .eq('status', 'ATIVO')
    .select('id')
    .maybeSingle()

  if (cancelarError || !canceladaAntiga) {
    // Compensa: a antiga não pôde ser cancelada (provável concorrência) —
    // remove a nova pra não deixar duplicidade.
    await supabaseAdmin.from('movimentacoes').delete().eq('id', nova.id)
    return { error: 'Esta movimentação foi alterada por outra operação simultânea. Tente novamente.' }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'financeiro',
      acao: 'EDICAO_MOVIMENTACAO',
      registroTabela: 'movimentacoes',
      registroId: nova.id,
      dadosAnteriores: {
        id: antiga.id,
        data: antiga.data,
        tipo: antiga.tipo,
        categoriaId: antiga.categoria_id,
        descricao: antiga.descricao,
        valor: antiga.valor,
        contaId: antiga.conta_id,
        formaPagamentoId: antiga.forma_pagamento_id,
        membroId: antiga.membro_id,
      },
      dadosNovos: {
        movimentacaoAntigaId: antiga.id,
        movimentacaoNovaId: nova.id,
        data,
        tipo,
        categoriaId,
        descricao,
        valor,
        contaId,
        formaPagamentoId,
        membroId,
        motivoEdicao,
      },
      descricao: `Edição da movimentação ${antiga.id} (substituída por ${nova.id})`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (movimentação editada com sucesso):', auditError)
  }

  const { erros: errosAnexos } = await uploadAnexosDoFormulario(supabaseAdmin, formData, 'anexos', {
    entidadeTipo: 'MOVIMENTACAO',
    entidadeId: nova.id,
    enviadoPor: usuario.id,
  })

  revalidatePath('/financeiro')

  if (errosAnexos.length > 0) {
    return { success: `Movimentação editada com sucesso. Falha ao anexar arquivo(s): ${errosAnexos.join(' ')}` }
  }
  return { success: 'Movimentação editada com sucesso.' }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros. Se o type-check reclamar da coluna `editada_de_id` não existir no tipo inferido do Supabase, isso é esperado até a migration da Task 1 ser aplicada no banco real conectado ao projeto (o cliente Supabase deste projeto não usa tipos gerados/`Database`, então `.insert()` aceita o campo sem checagem estrutural — confirme lendo `lib/supabase/server.ts` e `lib/supabase/service.ts`: nenhum dos dois passa um tipo `Database` genérico para `createServerClient`/`createClient`, então não há erro de tipo a esperar aqui).

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/financeiro/actions.ts"
git commit -m "feat: adiciona action editarMovimentacao (cancelar+recriar com auditoria)"
```

---

### Task 3: UI — formulário em modo edição, rota e botão

**Files:**
- Modify: `app/(app)/financeiro/nova/NovaMovimentacaoForm.tsx`
- Create: `app/(app)/financeiro/[id]/editar/page.tsx`
- Modify: `app/(app)/financeiro/MovimentacoesTable.tsx`

**Interfaces:**
- Consumes: `editarMovimentacao` de `../actions` (Task 2, relativo a `app/(app)/financeiro/nova/NovaMovimentacaoForm.tsx`) / `../../actions` (relativo a `app/(app)/financeiro/[id]/editar/page.tsx`); `registrarMovimentacao` (já existente); `AcessoNegado` de `@/components/AcessoNegado`; `createSupabaseServerClient` de `@/lib/supabase/server`.
- Produces: prop nova `modoEdicao?: { movimentacaoId: string; valoresIniciais: {...} }` em `NovaMovimentacaoForm`; rota `GET /financeiro/[id]/editar`; link "Editar" em `MovimentacoesTable.tsx`.

- [ ] **Step 1: Adicionar modo edição em `NovaMovimentacaoForm.tsx`**

Substitua o conteúdo de `app/(app)/financeiro/nova/NovaMovimentacaoForm.tsx` por:

```tsx
'use client'

import { useActionState, useState } from 'react'
import { registrarMovimentacao, editarMovimentacao } from '../actions'

type Categoria = { id: string; nome: string; tipo: string }
type Opcao = { id: string; nome: string }

type ValoresIniciais = {
  data: string
  tipo: string
  categoriaId: string
  descricao: string
  valor: number
  contaId: string
  formaPagamentoId: string
  membroId: string
  observacao: string
}

export function NovaMovimentacaoForm({
  categorias,
  contas,
  formasPagamento,
  membros,
  modoEdicao,
}: {
  categorias: Categoria[]
  contas: Opcao[]
  formasPagamento: Opcao[]
  membros: Opcao[]
  modoEdicao?: { movimentacaoId: string; valoresIniciais: ValoresIniciais }
}) {
  const action = modoEdicao ? editarMovimentacao : registrarMovimentacao
  const [state, formAction, pending] = useActionState(action, undefined)
  const [tipo, setTipo] = useState(modoEdicao?.valoresIniciais.tipo ?? 'ENTRADA')

  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipo)

  return (
    <form action={formAction} className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">
        {modoEdicao ? 'Editar movimentação' : 'Nova movimentação'}
      </h2>

      {modoEdicao && <input type="hidden" name="movimentacaoId" value={modoEdicao.movimentacaoId} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="tipo" className="text-sm font-medium text-slate-700">
            Tipo
          </label>
          <select
            id="tipo"
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ENTRADA">Entrada</option>
            <option value="SAIDA">Saída</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="categoriaId" className="text-sm font-medium text-slate-700">
            Categoria
          </label>
          <select
            id="categoriaId"
            name="categoriaId"
            required
            defaultValue={modoEdicao?.valoresIniciais.categoriaId}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {categoriasDoTipo.length === 0 && <option value="">Nenhuma categoria disponível</option>}
            {categoriasDoTipo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="data" className="text-sm font-medium text-slate-700">
            Data
          </label>
          <input
            id="data"
            name="data"
            type="date"
            required
            defaultValue={modoEdicao?.valoresIniciais.data}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="valor" className="text-sm font-medium text-slate-700">
            Valor
          </label>
          <input
            id="valor"
            name="valor"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={modoEdicao?.valoresIniciais.valor}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="contaId" className="text-sm font-medium text-slate-700">
            Conta
          </label>
          <select
            id="contaId"
            name="contaId"
            required
            defaultValue={modoEdicao?.valoresIniciais.contaId}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="formaPagamentoId" className="text-sm font-medium text-slate-700">
            Forma de pagamento
          </label>
          <select
            id="formaPagamentoId"
            name="formaPagamentoId"
            required
            defaultValue={modoEdicao?.valoresIniciais.formaPagamentoId}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {formasPagamento.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="membroId" className="text-sm font-medium text-slate-700">
            Membro (opcional)
          </label>
          <select
            id="membroId"
            name="membroId"
            defaultValue={modoEdicao?.valoresIniciais.membroId ?? ''}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">-</option>
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="descricao" className="text-sm font-medium text-slate-700">
            Descrição
          </label>
          <input
            id="descricao"
            name="descricao"
            type="text"
            defaultValue={modoEdicao?.valoresIniciais.descricao}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="observacao" className="text-sm font-medium text-slate-700">
            Observação
          </label>
          <textarea
            id="observacao"
            name="observacao"
            rows={2}
            defaultValue={modoEdicao?.valoresIniciais.observacao}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {modoEdicao && (
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="motivoEdicao" className="text-sm font-medium text-slate-700">
              Motivo da edição
            </label>
            <textarea
              id="motivoEdicao"
              name="motivoEdicao"
              rows={2}
              required
              placeholder="Ex.: valor lançado errado, deveria ser R$ 150,00"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="anexos" className="text-sm font-medium text-slate-700">
            Anexos (opcional)
          </label>
          <input
            id="anexos"
            name="anexos"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.csv,.xls,.xlsx"
            className="block w-full text-sm text-slate-700"
          />
        </div>
      </div>

      {state && 'error' in state && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state && 'success' in state && (
        <p className="text-sm text-green-700" role="status">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Salvando...' : modoEdicao ? 'Salvar edição' : 'Registrar'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Criar `app/(app)/financeiro/[id]/editar/page.tsx`**

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { FinanceiroTabs } from '../../FinanceiroTabs'
import { NovaMovimentacaoForm } from '../../nova/NovaMovimentacaoForm'

export default async function EditarMovimentacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMINISTRADOR' && profile?.role !== 'TESOUREIRO') {
    return <AcessoNegado />
  }

  const { data: movimentacao } = await supabase
    .from('movimentacoes')
    .select(
      'id, data, tipo, categoria_id, descricao, valor, conta_id, forma_pagamento_id, membro_id, observacao, status, origem'
    )
    .eq('id', id)
    .single()

  const [categorias, contas, formasPagamento, membros] = await Promise.all([
    supabase
      .from('categorias_movimentacao')
      .select('id, nome, tipo')
      .eq('sistema', false)
      .eq('ativo', true)
      .order('tipo')
      .order('nome'),
    supabase.from('contas').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('formas_pagamento').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('membros').select('id, nome').order('nome'),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Financeiro</h1>
      <FinanceiroTabs />

      {!movimentacao || movimentacao.status !== 'ATIVO' || movimentacao.origem === 'MENSALIDADE' ? (
        <p className="text-sm text-red-600">
          Esta movimentação não pode ser editada (não encontrada, já cancelada, ou gerada automaticamente por um
          pagamento de mensalidade).
        </p>
      ) : (
        <NovaMovimentacaoForm
          categorias={categorias.data ?? []}
          contas={contas.data ?? []}
          formasPagamento={formasPagamento.data ?? []}
          membros={membros.data ?? []}
          modoEdicao={{
            movimentacaoId: movimentacao.id,
            valoresIniciais: {
              data: movimentacao.data,
              tipo: movimentacao.tipo,
              categoriaId: movimentacao.categoria_id,
              descricao: movimentacao.descricao ?? '',
              valor: Number(movimentacao.valor),
              contaId: movimentacao.conta_id,
              formaPagamentoId: movimentacao.forma_pagamento_id,
              membroId: movimentacao.membro_id ?? '',
              observacao: movimentacao.observacao ?? '',
            },
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Adicionar link "Editar" em `MovimentacoesTable.tsx`**

Em `app/(app)/financeiro/MovimentacoesTable.tsx`, adicione o import do `Link` no topo do arquivo:

```tsx
import Link from 'next/link'
```

Substitua o bloco de ações (dentro de `{podeEditar && (...)}`, dentro do `<td>` de Ações) de:

```tsx
              {podeEditar && (
                <td className="px-4 py-2">
                  {mov.status === 'ATIVO' && mov.origem !== 'MENSALIDADE' && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleCancelar(mov)}
                      className="text-slate-700 underline disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  )}
                  {mov.status === 'ATIVO' && mov.origem === 'MENSALIDADE' && (
                    <span className="text-xs text-slate-400">via Mensalidades</span>
                  )}
                </td>
              )}
```

para:

```tsx
              {podeEditar && (
                <td className="px-4 py-2">
                  {mov.status === 'ATIVO' && mov.origem !== 'MENSALIDADE' && (
                    <>
                      <Link href={`/financeiro/${mov.id}/editar`} className="mr-3 text-slate-700 underline">
                        Editar
                      </Link>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleCancelar(mov)}
                        className="text-slate-700 underline disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                  {mov.status === 'ATIVO' && mov.origem === 'MENSALIDADE' && (
                    <span className="text-xs text-slate-400">via Mensalidades</span>
                  )}
                </td>
              )}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/financeiro/nova/NovaMovimentacaoForm.tsx" "app/(app)/financeiro/[id]/editar/page.tsx" "app/(app)/financeiro/MovimentacoesTable.tsx"
git commit -m "feat: formulario e botao de edicao de movimentacao financeira"
```

---

### Task 4: Suíte completa e verificação manual

**Files:**
- Nenhum arquivo novo/alterado — só verificação.

**Interfaces:**
- Consumes: nada novo.
- Produces: confirmação de que a feature funciona ponta a ponta.

- [ ] **Step 1: Rodar a suíte de testes completa e o type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, sem erros de tipo. (Nenhum teste novo é esperado nesta feature — ver seção "Testes" da spec: a lógica nova em `editarMovimentacao` é majoritariamente orquestração de I/O sobre validação de domínio já testada, mesmo padrão de `cancelarMovimentacao`/`registrarMovimentacao`, que também não têm testes unitários próprios.)

- [ ] **Step 2: Aplicar a migration da Task 1 no banco**

Esta migration precisa ser aplicada manualmente no Supabase (Dashboard → SQL Editor, ou o processo que o usuário já usa pras 27 migrations anteriores) antes da verificação manual abaixo funcionar — sem a coluna `editada_de_id`, o `insert` em `editarMovimentacao` falha. Confirme com o usuário que a migration foi aplicada antes de prosseguir para o Step 3.

- [ ] **Step 3: Verificação manual no navegador (requer login)**

1. Logar no sistema com um usuário Tesoureiro ou Administrador e ir em `/financeiro`.
2. Na tabela de Movimentações, localizar uma movimentação `ATIVO` de origem manual (não "via Mensalidades") e clicar em "Editar".
3. Conferir que o formulário abre pré-preenchido com os valores atuais, com o campo "Motivo da edição" visível e obrigatório, e o botão "Salvar edição".
4. Alterar o valor (ex.: de R$ 100,00 para R$ 150,00), preencher o motivo, e salvar.
5. Voltar pra `/financeiro` e conferir:
   - A movimentação antiga aparece como "Cancelada", com o motivo mostrando "Editada — substituída pela movimentação ... Motivo: ...".
   - Uma movimentação nova aparece como "Ativa" com o valor corrigido (R$ 150,00).
   - Os totais de entrada/saída da tela batem com o valor novo (não contam a antiga cancelada).
6. Tentar acessar `/financeiro/<id-de-uma-movimentacao-ja-cancelada>/editar` diretamente pela URL — confirmar que mostra a mensagem de erro em vez do formulário.
7. Confirmar que uma movimentação de origem "via Mensalidades" não mostra o link "Editar" (só o texto "via Mensalidades").
8. Reportar qualquer divergência encontrada antes de considerar a task concluída.

- [ ] **Step 4: Nenhum commit nesta task** (task de verificação apenas).
