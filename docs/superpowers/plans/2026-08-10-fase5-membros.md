# Fase 5 — Membros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRUD de membros (SPEC §6): listagem com filtros, criação, edição, detalhe. Nenhum delete físico — sair do quadro é `do_quadro=false`, histórico permanece. `situacao` é campo do sistema (calculado a partir de inadimplência na Fase 6), não editável manualmente.

**Architecture:** Segue exatamente o padrão já validado em Configurações (Fase 4): Server Component faz gate de autorização + leitura (RLS), Server Actions com `service_role` protegidas por `requireAdmin()` para escrita, `registrarAuditoria` grava o rastro. Leitura (`/membros`) é liberada a qualquer autenticado (RLS `membros_select_authenticated`); escrita é exclusiva do Administrador (RLS `membros_write_admin` — Tesoureiro só consulta, SPEC §3).

**Tech Stack:** Next.js Server Actions, Vitest.

## Global Constraints

- Nenhum delete físico de membro (SPEC §6: "Não apagar membro que deixou de pertencer ao quadro").
- Escrita em `membros` restrita a `ADMINISTRADOR` — `requireAdmin()` em toda Server Action, checagem de role em toda página (mesmo padrão de `lib/auth/require-role.ts`, já existe).
- Toda criação/edição gera auditoria via `registrarAuditoria` (`lib/audit.ts`, já existe), em try/catch que não interrompe o retorno de sucesso.
- `situacao` não é um campo editável no formulário — é preenchido `ATIVO` por padrão na criação (default da tabela) e só muda via cálculo de inadimplência (regra centralizada nesta fase, mas só *acionada* de verdade na Fase 6, quando existirem competências de mensalidade reais).
- TypeScript estrito, sem `any` não justificado.

## Decisão técnica (não bloqueante)

A regra de inadimplência (SPEC §7: "mais de 6 competências vencidas = INATIVO") é implementada agora como função pura testável (`calcularSituacaoMembro`), pronta para ser chamada pela Fase 6 quando pagamentos/competências existirem de verdade. Nesta fase ela não é conectada a nenhum job automático — não há dado de mensalidade ainda para calcular em cima. Isso cumpre o pedido do SPEC de ter a regra "centralizada e testada" sem inventar um gatilho automático prematuro.

---

## Task 1: Domínio — validação de membro e regra de inadimplência

**Files:**
- Create: `lib/domain/membros.ts`
- Test: `lib/domain/membros.test.ts`
- Create: `lib/domain/inadimplencia.ts`
- Test: `lib/domain/inadimplencia.test.ts`

**Interfaces:**
- Produces: `validarMembro(input: {nome: string; matricula: string}): {valido: true} | {valido: false; erro: string}`, `calcularSituacaoMembro(competenciasVencidasNaoPagas: number): 'ATIVO' | 'INATIVO'`.

- [ ] **Step 1: Escrever o teste de `validarMembro`**

```typescript
// lib/domain/membros.test.ts
import { describe, expect, it } from 'vitest'
import { validarMembro } from './membros'

describe('validarMembro', () => {
  it('aceita um input válido', () => {
    expect(validarMembro({ nome: 'João Silva', matricula: '1234' })).toEqual({ valido: true })
  })

  it('rejeita nome vazio', () => {
    expect(validarMembro({ nome: '  ', matricula: '1234' })).toEqual({
      valido: false,
      erro: 'Informe o nome do membro.',
    })
  })

  it('rejeita matrícula vazia', () => {
    expect(validarMembro({ nome: 'João Silva', matricula: '' })).toEqual({
      valido: false,
      erro: 'Informe a matrícula.',
    })
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run lib/domain/membros.test.ts`
Expected: FAIL — `Cannot find module './membros'`.

- [ ] **Step 3: Implementar `lib/domain/membros.ts`**

```typescript
export type ValidationResult = { valido: true } | { valido: false; erro: string }

export function validarMembro(input: { nome: string; matricula: string }): ValidationResult {
  if (input.nome.trim().length === 0) {
    return { valido: false, erro: 'Informe o nome do membro.' }
  }

  if (input.matricula.trim().length === 0) {
    return { valido: false, erro: 'Informe a matrícula.' }
  }

  return { valido: true }
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run lib/domain/membros.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Escrever o teste de `calcularSituacaoMembro`**

```typescript
// lib/domain/inadimplencia.test.ts
import { describe, expect, it } from 'vitest'
import { calcularSituacaoMembro } from './inadimplencia'

describe('calcularSituacaoMembro', () => {
  it('retorna ATIVO com zero competências vencidas', () => {
    expect(calcularSituacaoMembro(0)).toBe('ATIVO')
  })

  it('retorna ATIVO com exatamente 6 competências vencidas (limite)', () => {
    expect(calcularSituacaoMembro(6)).toBe('ATIVO')
  })

  it('retorna INATIVO com 7 competências vencidas', () => {
    expect(calcularSituacaoMembro(7)).toBe('INATIVO')
  })

  it('retorna INATIVO com muitas competências vencidas', () => {
    expect(calcularSituacaoMembro(20)).toBe('INATIVO')
  })
})
```

- [ ] **Step 6: Rodar e confirmar falha**

Run: `npx vitest run lib/domain/inadimplencia.test.ts`
Expected: FAIL — `Cannot find module './inadimplencia'`.

- [ ] **Step 7: Implementar `lib/domain/inadimplencia.ts`**

```typescript
/**
 * Regra de inadimplência (SPEC §7): mais de 6 competências vencidas e não
 * pagas torna o membro INATIVO. Reativação para ATIVO é automática quando
 * o número volta a 6 ou menos. Esta função é pura — quem chama é
 * responsável por contar as competências vencidas (Fase 6, quando
 * mensalidades reais existirem).
 */
export function calcularSituacaoMembro(competenciasVencidasNaoPagas: number): 'ATIVO' | 'INATIVO' {
  return competenciasVencidasNaoPagas > 6 ? 'INATIVO' : 'ATIVO'
}
```

- [ ] **Step 8: Rodar e confirmar sucesso**

Run: `npx vitest run lib/domain/inadimplencia.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 9: Commit**

```bash
git add lib/domain/membros.ts lib/domain/membros.test.ts lib/domain/inadimplencia.ts lib/domain/inadimplencia.test.ts
git commit -m "feat: validação de membro e regra de inadimplência com testes"
```

---

## Task 2: Server Actions de membros

**Files:**
- Create: `app/(app)/membros/actions.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `AuthorizationError` (`lib/auth/require-role.ts`), `createSupabaseServiceRoleClient` (`lib/supabase/service.ts`), `registrarAuditoria` (`lib/audit.ts`), `validarMembro` (`lib/domain/membros.ts`).
- Produces: `criarMembro(prevState, formData): Promise<{error: string} | undefined>` (redireciona para `/membros/[id]` em sucesso, nunca retorna estado de sucesso), `atualizarMembro(id: string, dados: {nome: string; matricula: string; telefone: string; doQuadro: boolean; remido: boolean; recolhe: boolean}): Promise<{error?: string}>`.

- [ ] **Step 1: Criar `app/(app)/membros/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { validarMembro } from '@/lib/domain/membros'

type ActionState = { error: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function criarMembro(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const nome = String(formData.get('nome') ?? '')
  const matricula = String(formData.get('matricula') ?? '')
  const telefone = String(formData.get('telefone') ?? '')
  const doQuadro = formData.get('doQuadro') === 'on'
  const remido = formData.get('remido') === 'on'
  const recolhe = formData.get('recolhe') === 'on'

  const validacao = validarMembro({ nome, matricula })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const dadosPersistidos = {
    nome: nome.trim(),
    matricula: matricula.trim(),
    telefone: telefone.trim() || null,
    do_quadro: doQuadro,
    remido,
    recolhe,
  }

  const { data: criado, error } = await supabaseAdmin
    .from('membros')
    .insert(dadosPersistidos)
    .select('id')
    .single()

  if (error || !criado) {
    if (error?.code === '23505') {
      return { error: 'Já existe um membro com essa matrícula.' }
    }
    return { error: `Falha ao criar membro: ${error?.message ?? 'erro desconhecido'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'membros',
      acao: 'CRIACAO',
      registroTabela: 'membros',
      registroId: criado.id,
      dadosNovos: dadosPersistidos,
      descricao: `Criação do membro ${dadosPersistidos.nome}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (membro criado com sucesso):', auditError)
  }

  revalidatePath('/membros')
  redirect(`/membros/${criado.id}`)
}

export async function atualizarMembro(
  id: string,
  dados: {
    nome: string
    matricula: string
    telefone: string
    doQuadro: boolean
    remido: boolean
    recolhe: boolean
  }
): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const validacao = validarMembro(dados)
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anterior } = await supabaseAdmin
    .from('membros')
    .select('nome, matricula, telefone, do_quadro, remido, recolhe')
    .eq('id', id)
    .single()

  const dadosPersistidos = {
    nome: dados.nome.trim(),
    matricula: dados.matricula.trim(),
    telefone: dados.telefone.trim() || null,
    do_quadro: dados.doQuadro,
    remido: dados.remido,
    recolhe: dados.recolhe,
  }

  const { data: atualizado, error } = await supabaseAdmin
    .from('membros')
    .update(dadosPersistidos)
    .eq('id', id)
    .select('id')
    .single()

  if (error || !atualizado) {
    if (error?.code === '23505') {
      return { error: 'Já existe um membro com essa matrícula.' }
    }
    return { error: `Falha ao atualizar membro: ${error?.message ?? 'membro não encontrado'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'membros',
      acao: 'EDICAO',
      registroTabela: 'membros',
      registroId: id,
      dadosAnteriores: anterior ?? null,
      dadosNovos: dadosPersistidos,
      descricao: `Edição do membro ${dadosPersistidos.nome}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (membro atualizado com sucesso):', auditError)
  }

  revalidatePath('/membros')
  revalidatePath(`/membros/${id}`)
  return {}
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/membros/actions.ts"
git commit -m "feat: Server Actions de membros com auditoria"
```

---

## Task 3: UI — listagem de membros com filtros

**Files:**
- Create: `app/(app)/membros/page.tsx`

**Interfaces:**
- Consumes: `createSupabaseServerClient` (`lib/supabase/server.ts`), `AcessoNegado` (`components/AcessoNegado.tsx`).

- [ ] **Step 1: Criar `app/(app)/membros/page.tsx`**

```tsx
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'

type SearchParams = {
  nome?: string
  situacao?: string
  do_quadro?: string
  remido?: string
  recolhe?: string
}

export default async function MembrosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'ADMINISTRADOR'

  let query = supabase
    .from('membros')
    .select('id, nome, telefone, matricula, do_quadro, remido, recolhe, situacao')
    .order('nome')

  if (params.nome) {
    query = query.ilike('nome', `%${params.nome}%`)
  }
  if (params.situacao) {
    query = query.eq('situacao', params.situacao)
  }
  if (params.do_quadro) {
    query = query.eq('do_quadro', params.do_quadro === 'true')
  }
  if (params.remido) {
    query = query.eq('remido', params.remido === 'true')
  }
  if (params.recolhe) {
    query = query.eq('recolhe', params.recolhe === 'true')
  }

  const { data: membros, error } = await query

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar membros: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Membros</h1>
        {isAdmin && (
          <Link
            href="/membros/novo"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Novo Membro
          </Link>
        )}
      </div>

      <form className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <input
          name="nome"
          type="text"
          placeholder="Buscar por nome"
          defaultValue={params.nome ?? ''}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          name="situacao"
          defaultValue={params.situacao ?? ''}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Situação (todas)</option>
          <option value="ATIVO">Ativo</option>
          <option value="INATIVO">Inativo</option>
        </select>
        <select
          name="do_quadro"
          defaultValue={params.do_quadro ?? ''}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Do quadro (todos)</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
        <select
          name="remido"
          defaultValue={params.remido ?? ''}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Remido (todos)</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
        <select
          name="recolhe"
          defaultValue={params.recolhe ?? ''}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Recolhe (todos)</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
        <button
          type="submit"
          className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Filtrar
        </button>
      </form>

      {membros.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum membro encontrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">Telefone</th>
                <th className="px-4 py-2 font-medium">Matrícula</th>
                <th className="px-4 py-2 font-medium">Do quadro</th>
                <th className="px-4 py-2 font-medium">Remido</th>
                <th className="px-4 py-2 font-medium">Recolhe</th>
                <th className="px-4 py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {membros.map((membro) => (
                <tr key={membro.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/membros/${membro.id}`} className="font-medium text-slate-900 underline">
                      {membro.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{membro.telefone ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{membro.matricula}</td>
                  <td className="px-4 py-2">{membro.do_quadro ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-2">{membro.remido ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-2">{membro.recolhe ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-2">
                    <span className={membro.situacao === 'ATIVO' ? 'text-green-700' : 'text-slate-400'}>
                      {membro.situacao}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/membros/page.tsx"
git commit -m "feat: listagem de membros com filtros"
```

---

## Task 4: UI — criação e detalhe/edição de membro

**Files:**
- Create: `app/(app)/membros/novo/page.tsx`
- Create: `app/(app)/membros/novo/NovoMembroForm.tsx`
- Create: `app/(app)/membros/[id]/page.tsx`
- Create: `app/(app)/membros/[id]/MembroDetalhe.tsx`

**Interfaces:**
- Consumes: `criarMembro`, `atualizarMembro` (Task 2), `AcessoNegado`, `createSupabaseServerClient`.

- [ ] **Step 1: Criar `app/(app)/membros/novo/NovoMembroForm.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { criarMembro } from '../actions'

export function NovoMembroForm() {
  const [state, formAction, pending] = useActionState(criarMembro, undefined)

  return (
    <form action={formAction} className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <div className="space-y-1">
        <label htmlFor="nome" className="text-sm font-medium text-slate-700">
          Nome
        </label>
        <input
          id="nome"
          name="nome"
          type="text"
          required
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="matricula" className="text-sm font-medium text-slate-700">
          Matrícula
        </label>
        <input
          id="matricula"
          name="matricula"
          type="text"
          required
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="telefone" className="text-sm font-medium text-slate-700">
          Telefone (opcional)
        </label>
        <input
          id="telefone"
          name="telefone"
          type="text"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="doQuadro" defaultChecked />
          Do quadro
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="remido" />
          Remido
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="recolhe" />
          Recolhe
        </label>
      </div>

      {state && 'error' in state && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Criando...' : 'Criar membro'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Criar `app/(app)/membros/novo/page.tsx`**

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { NovoMembroForm } from './NovoMembroForm'

export default async function NovoMembroPage() {
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
      <h1 className="text-lg font-semibold text-slate-900">Novo Membro</h1>
      <NovoMembroForm />
    </div>
  )
}
```

- [ ] **Step 3: Criar `app/(app)/membros/[id]/MembroDetalhe.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { atualizarMembro } from '../actions'

type Membro = {
  id: string
  nome: string
  telefone: string | null
  matricula: string
  do_quadro: boolean
  remido: boolean
  recolhe: boolean
  situacao: string
  data_cadastro: string
}

export function MembroDetalhe({ membro, isAdmin }: { membro: Membro; isAdmin: boolean }) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [nome, setNome] = useState(membro.nome)
  const [matricula, setMatricula] = useState(membro.matricula)
  const [telefone, setTelefone] = useState(membro.telefone ?? '')
  const [doQuadro, setDoQuadro] = useState(membro.do_quadro)
  const [remido, setRemido] = useState(membro.remido)
  const [recolhe, setRecolhe] = useState(membro.recolhe)
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null)

  function handleSave() {
    startTransition(async () => {
      const result = await atualizarMembro(membro.id, {
        nome,
        matricula,
        telefone,
        doQuadro,
        remido,
        recolhe,
      })
      setFeedback({ message: result.error ?? 'Membro atualizado.', isError: Boolean(result.error) })
      if (!result.error) {
        setEditing(false)
      }
    })
  }

  return (
    <div className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      {editing ? (
        <>
          <div className="space-y-1">
            <label htmlFor="nome" className="text-sm font-medium text-slate-700">
              Nome
            </label>
            <input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="matricula" className="text-sm font-medium text-slate-700">
              Matrícula
            </label>
            <input
              id="matricula"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="telefone" className="text-sm font-medium text-slate-700">
              Telefone
            </label>
            <input
              id="telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={doQuadro} onChange={(e) => setDoQuadro(e.target.checked)} />
              Do quadro
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={remido} onChange={(e) => setRemido(e.target.checked)} />
              Remido
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={recolhe} onChange={(e) => setRecolhe(e.target.checked)} />
              Recolhe
            </label>
          </div>
          <div className="space-x-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Matrícula</dt>
              <dd className="font-medium text-slate-900">{membro.matricula}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Telefone</dt>
              <dd className="font-medium text-slate-900">{membro.telefone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Do quadro</dt>
              <dd className="font-medium text-slate-900">{membro.do_quadro ? 'Sim' : 'Não'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Remido</dt>
              <dd className="font-medium text-slate-900">{membro.remido ? 'Sim' : 'Não'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Recolhe</dt>
              <dd className="font-medium text-slate-900">{membro.recolhe ? 'Sim' : 'Não'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Situação</dt>
              <dd
                className={
                  membro.situacao === 'ATIVO' ? 'font-medium text-green-700' : 'font-medium text-slate-400'
                }
              >
                {membro.situacao}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Cadastrado em</dt>
              <dd className="font-medium text-slate-900">
                {new Date(membro.data_cadastro).toLocaleDateString('pt-BR')}
              </dd>
            </div>
          </dl>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              Editar
            </button>
          )}
        </>
      )}

      {feedback && (
        <p
          className={`text-sm ${feedback.isError ? 'text-red-600' : 'text-green-700'}`}
          role={feedback.isError ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Criar `app/(app)/membros/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { MembroDetalhe } from './MembroDetalhe'

export default async function MembroDetalhePage({
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
  const isAdmin = profile?.role === 'ADMINISTRADOR'

  const { data: membro, error } = await supabase
    .from('membros')
    .select('id, nome, telefone, matricula, do_quadro, remido, recolhe, situacao, data_cadastro')
    .eq('id', id)
    .single()

  if (error || !membro) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">{membro.nome}</h1>
      <MembroDetalhe membro={membro} isAdmin={isAdmin} />
    </div>
  )
}
```

- [ ] **Step 5: Typecheck, lint e build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/membros/novo" "app/(app)/membros/[id]"
git commit -m "feat: criação e detalhe/edição de membro"
```

---

## Task 5: Checagem final

**Files:**
- Modify: `docs/arquitetura.md` (adicionar os novos arquivos à árvore de pastas)

- [ ] **Step 1: Atualizar `docs/arquitetura.md`**

Adicionar à árvore de pastas: `lib/domain/membros.ts`, `lib/domain/inadimplencia.ts` (+ `.test.ts` de cada), `app/(app)/membros/{actions.ts,page.tsx,novo/*,[id]/*}`.

- [ ] **Step 2: Checagem final**

```bash
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add docs/arquitetura.md
git commit -m "docs: atualiza arquitetura com módulo de membros"
```

---

## Self-Review (spec coverage)

- CRUD de membros (nome, telefone, matrícula, do_quadro, remido, recolhe) — SPEC §6 → Tasks 2-4. ✅
- Nenhum delete físico, `do_quadro=false` ao sair — SPEC §6 → sem botão de excluir em lugar nenhum, só edição. ✅
- Situação ATIVO/INATIVO — SPEC §6 → coluna exibida, não editável manualmente. ✅
- Regra de inadimplência centralizada e testada — SPEC §7 → Task 1 (`calcularSituacaoMembro`), pronta para a Fase 6 conectar aos dados reais de mensalidade. ✅
- Filtros (nome, situação, quadro, remido, recolhe) — SPEC §34 wireframe → Task 3. ✅
- Autorização: Administrador gerencia, Tesoureiro/Consulta só veem — SPEC §3 → RLS já existente (Fase 2) + `requireAdmin()` nas Server Actions. ✅
- Auditoria de criação/edição — CLAUDE.md §12 → Task 2. ✅

## Pendência conhecida

Testado manualmente pelo usuário contra o Supabase real (fluxo já usado nas fases anteriores) — não faço teste de navegador nesta fase, conforme solicitado.
