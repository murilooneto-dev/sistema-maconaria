# Fase 4 — Configurações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar as telas de Configurações administrativas do SPEC §28: Loja (nome + logo), Mensalidade normal e Remido (valores configuráveis com histórico versionado), Contas (CRUD), Formas de pagamento (CRUD) e Recibo (assinatura). `Usuários` já foi entregue na Fase 3. Todas as telas são restritas a Administrador, com auditoria de toda alteração.

**Architecture:** Segue exatamente os padrões já estabelecidos: Server Component faz o gate de autorização + leitura (RLS), Server Actions usam `service_role` protegido por `requireAdmin()` (Fase 3) para escrita, `registrarAuditoria` grava o rastro. Upload de imagem (logo/assinatura) usa Supabase Storage — um bucket público único (`loja-assets`) com policies de escrita restritas a admin, acessado via `service_role` a partir das Server Actions (mesmo padrão de autorização das tabelas). `config_mensalidade` já é append-only por design (Fase 2) — a Server Action só insere uma nova versão, nunca edita uma existente, preservando o histórico de valores aplicados a competências antigas.

**Tech Stack:** Next.js Server Actions, Supabase Storage, Vitest.

## Global Constraints

- Toda tela e toda Server Action deste plano são restritas a `ADMINISTRADOR` (SPEC §3, §28) — usar `requireAdmin()` (`lib/auth/require-role.ts`, já existe da Fase 3) em toda Server Action, e o mesmo padrão de checagem de role usado em `/configuracoes/usuarios/page.tsx` em toda página Server Component.
- Toda criação/edição gera uma linha em `auditoria` via `registrarAuditoria` (`lib/audit.ts`, já existe) — envolvida em try/catch que não interrompe o retorno de sucesso da operação principal (mesmo padrão da Fase 3, decisão técnica 2 daquele plano).
- Nenhuma tabela financeira/cadastral tem delete físico — `contas` e `formas_pagamento` só têm campo `ativo`, sem policy de DELETE (Fase 2); a UI nunca oferece "excluir", só "desativar/reativar".
- `config_mensalidade` nunca é editada nem deletada — só inserção de novas versões (constraint de banco da Fase 2: sem policy de UPDATE/DELETE).
- NUMERIC/dinheiro tratado como number em TypeScript, formatado com `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })` para exibição — consistente em toda tela.
- TypeScript estrito, sem `any` não justificado.

## Decisões técnicas (não bloqueantes, puramente técnicas)

1. **`loja_config` ganha uma coluna nova `assinatura_url`** via migration nova (`00000000000016`), nunca editando as 15 migrations já commitadas.
2. **Bucket de Storage único `loja-assets`, público para leitura**, com subpastas por convenção de path (`logo/`, `assinaturas/`) em vez de buckets separados — mais simples de administrar, e a distinção lógica (o que é logo vs. assinatura) já vive em colunas separadas de `loja_config`.
3. **`contas.saldo_inicial` e `contas.data_saldo_inicial` continuam editáveis após a criação** nesta fase — não há nenhum módulo financeiro (Fase 7) ainda construído que dependa desses valores para cálculos históricos, então não há risco de distorcer dado histórico agora. Quando a Fase 7 (fechamento mensal) existir, essa decisão deve ser revisitada (travar edição de saldo inicial se já houver movimentações).
4. **`registro_id` da auditoria é omitido (não preenchido) para operações em `loja_config`** — a coluna `auditoria.registro_id` é `uuid`, mas `loja_config.id` é `smallint` (tabela singleton). `registro_tabela: 'loja_config'` já identifica a origem sem precisar de um id compatível.

---

## Task 1: Migration — `loja_config.assinatura_url` + Storage bucket

**Files:**
- Create: `supabase/migrations/00000000000016_loja_assets.sql`

- [ ] **Step 1: Criar a migration**

```sql
alter table public.loja_config
  add column assinatura_url text;

insert into storage.buckets (id, name, public)
values ('loja-assets', 'loja-assets', true)
on conflict (id) do nothing;

-- storage.objects já vem com RLS habilitada por padrão em todo projeto Supabase,
-- não é necessário (nem seguro) tentar habilitar de novo aqui.

create policy "loja_assets_select_public"
  on storage.objects for select
  using (bucket_id = 'loja-assets');

create policy "loja_assets_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'loja-assets' and public.is_admin());

create policy "loja_assets_update_admin"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'loja-assets' and public.is_admin())
  with check (bucket_id = 'loja-assets' and public.is_admin());
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/00000000000016_loja_assets.sql
git commit -m "feat(db): coluna assinatura_url em loja_config e bucket loja-assets"
```

---

## Task 2: Domínio de validação de Configurações

**Files:**
- Create: `lib/domain/configuracoes.ts`
- Test: `lib/domain/configuracoes.test.ts`

**Interfaces:**
- Produces: `ValidationResult = { valido: true } | { valido: false; erro: string }`, `validarLoja(input: {nome: string}): ValidationResult`, `validarConfigMensalidade(input: {tipo: string; valorMensalidade: number; valorGrandeLoja: number}): ValidationResult`, `validarConta(input: {nome: string; saldoInicial: number; dataSaldoInicial: string}): ValidationResult`, `validarFormaPagamento(input: {nome: string}): ValidationResult`.

- [ ] **Step 1: Escrever o teste que falha primeiro**

```typescript
// lib/domain/configuracoes.test.ts
import { describe, expect, it } from 'vitest'
import {
  validarConfigMensalidade,
  validarConta,
  validarFormaPagamento,
  validarLoja,
} from './configuracoes'

describe('validarLoja', () => {
  it('aceita um nome válido', () => {
    expect(validarLoja({ nome: 'Loja Exemplo' })).toEqual({ valido: true })
  })

  it('rejeita nome vazio', () => {
    expect(validarLoja({ nome: '  ' })).toEqual({ valido: false, erro: 'Informe o nome da loja.' })
  })
})

describe('validarConfigMensalidade', () => {
  const base = { tipo: 'NORMAL', valorMensalidade: 150, valorGrandeLoja: 50 }

  it('aceita um input válido', () => {
    expect(validarConfigMensalidade(base)).toEqual({ valido: true })
  })

  it('rejeita tipo inválido', () => {
    expect(validarConfigMensalidade({ ...base, tipo: 'X' })).toEqual({
      valido: false,
      erro: 'Tipo inválido.',
    })
  })

  it('rejeita valor de mensalidade negativo', () => {
    expect(validarConfigMensalidade({ ...base, valorMensalidade: -1 })).toEqual({
      valido: false,
      erro: 'Informe um valor de mensalidade válido.',
    })
  })

  it('rejeita valor de mensalidade não numérico', () => {
    expect(validarConfigMensalidade({ ...base, valorMensalidade: Number('abc') })).toEqual({
      valido: false,
      erro: 'Informe um valor de mensalidade válido.',
    })
  })

  it('rejeita valor de Grande Loja negativo', () => {
    expect(validarConfigMensalidade({ ...base, valorGrandeLoja: -1 })).toEqual({
      valido: false,
      erro: 'Informe um valor de Grande Loja válido.',
    })
  })

  it('rejeita valor de Grande Loja maior que o valor da mensalidade', () => {
    expect(validarConfigMensalidade({ ...base, valorGrandeLoja: 200 })).toEqual({
      valido: false,
      erro: 'O valor da Grande Loja não pode ser maior que o valor da mensalidade.',
    })
  })
})

describe('validarConta', () => {
  const base = { nome: 'Caixa', saldoInicial: 100, dataSaldoInicial: '2026-01-01' }

  it('aceita um input válido', () => {
    expect(validarConta(base)).toEqual({ valido: true })
  })

  it('rejeita nome vazio', () => {
    expect(validarConta({ ...base, nome: '' })).toEqual({
      valido: false,
      erro: 'Informe o nome da conta.',
    })
  })

  it('rejeita saldo inicial não numérico', () => {
    expect(validarConta({ ...base, saldoInicial: Number('abc') })).toEqual({
      valido: false,
      erro: 'Informe um saldo inicial válido.',
    })
  })

  it('rejeita data do saldo inicial vazia', () => {
    expect(validarConta({ ...base, dataSaldoInicial: '' })).toEqual({
      valido: false,
      erro: 'Informe a data do saldo inicial.',
    })
  })
})

describe('validarFormaPagamento', () => {
  it('aceita um nome válido', () => {
    expect(validarFormaPagamento({ nome: 'PIX' })).toEqual({ valido: true })
  })

  it('rejeita nome vazio', () => {
    expect(validarFormaPagamento({ nome: '' })).toEqual({
      valido: false,
      erro: 'Informe o nome da forma de pagamento.',
    })
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run lib/domain/configuracoes.test.ts`
Expected: FAIL — `Cannot find module './configuracoes'`.

- [ ] **Step 3: Implementar `lib/domain/configuracoes.ts`**

```typescript
export type ValidationResult = { valido: true } | { valido: false; erro: string }

export function validarLoja(input: { nome: string }): ValidationResult {
  if (input.nome.trim().length === 0) {
    return { valido: false, erro: 'Informe o nome da loja.' }
  }
  return { valido: true }
}

export function validarConfigMensalidade(input: {
  tipo: string
  valorMensalidade: number
  valorGrandeLoja: number
}): ValidationResult {
  if (input.tipo !== 'NORMAL' && input.tipo !== 'REMIDO') {
    return { valido: false, erro: 'Tipo inválido.' }
  }

  if (!Number.isFinite(input.valorMensalidade) || input.valorMensalidade < 0) {
    return { valido: false, erro: 'Informe um valor de mensalidade válido.' }
  }

  if (!Number.isFinite(input.valorGrandeLoja) || input.valorGrandeLoja < 0) {
    return { valido: false, erro: 'Informe um valor de Grande Loja válido.' }
  }

  if (input.valorGrandeLoja > input.valorMensalidade) {
    return {
      valido: false,
      erro: 'O valor da Grande Loja não pode ser maior que o valor da mensalidade.',
    }
  }

  return { valido: true }
}

export function validarConta(input: {
  nome: string
  saldoInicial: number
  dataSaldoInicial: string
}): ValidationResult {
  if (input.nome.trim().length === 0) {
    return { valido: false, erro: 'Informe o nome da conta.' }
  }

  if (!Number.isFinite(input.saldoInicial)) {
    return { valido: false, erro: 'Informe um saldo inicial válido.' }
  }

  if (input.dataSaldoInicial.trim().length === 0) {
    return { valido: false, erro: 'Informe a data do saldo inicial.' }
  }

  return { valido: true }
}

export function validarFormaPagamento(input: { nome: string }): ValidationResult {
  if (input.nome.trim().length === 0) {
    return { valido: false, erro: 'Informe o nome da forma de pagamento.' }
  }
  return { valido: true }
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run lib/domain/configuracoes.test.ts`
Expected: PASS (13 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/configuracoes.ts lib/domain/configuracoes.test.ts
git commit -m "feat: validação de domínio para telas de Configurações com testes"
```

---

## Task 3: Loja e Recibo (nome, logo, assinatura)

**Files:**
- Create: `app/(app)/configuracoes/loja/actions.ts`
- Create: `app/(app)/configuracoes/loja/LojaForm.tsx`
- Create: `app/(app)/configuracoes/loja/page.tsx`
- Create: `app/(app)/configuracoes/recibo/actions.ts`
- Create: `app/(app)/configuracoes/recibo/AssinaturaForm.tsx`
- Create: `app/(app)/configuracoes/recibo/page.tsx`

**Interfaces:**
- Consumes: `requireAdmin`, `AuthorizationError` (`lib/auth/require-role.ts`), `createSupabaseServiceRoleClient` (`lib/supabase/service.ts`), `registrarAuditoria` (`lib/audit.ts`), `validarLoja` (`lib/domain/configuracoes.ts`), `AcessoNegado` (`components/AcessoNegado.tsx`), `createSupabaseServerClient` (`lib/supabase/server.ts`).

- [ ] **Step 1: Criar `app/(app)/configuracoes/loja/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { validarLoja } from '@/lib/domain/configuracoes'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function atualizarLoja(
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
  const validacao = validarLoja({ nome })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const logo = formData.get('logo')
  let logoUrl: string | undefined

  if (logo instanceof File && logo.size > 0) {
    const path = `logo/${Date.now()}-${logo.name}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('loja-assets')
      .upload(path, logo, { upsert: false })

    if (uploadError) {
      return { error: `Falha ao enviar logo: ${uploadError.message}` }
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from('loja-assets').getPublicUrl(path)
    logoUrl = publicUrlData.publicUrl
  }

  const { data: anterior } = await supabaseAdmin
    .from('loja_config')
    .select('nome, logo_url')
    .eq('id', 1)
    .single()

  const dadosNovos: { nome: string; logo_url?: string } = { nome: nome.trim() }
  if (logoUrl) {
    dadosNovos.logo_url = logoUrl
  }

  const { error } = await supabaseAdmin.from('loja_config').update(dadosNovos).eq('id', 1)

  if (error) {
    return { error: `Falha ao atualizar dados da loja: ${error.message}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'EDICAO_LOJA',
      registroTabela: 'loja_config',
      dadosAnteriores: anterior ?? null,
      dadosNovos,
      descricao: 'Atualização dos dados da Loja',
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (loja atualizada com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/loja')
  return { success: 'Dados da Loja atualizados com sucesso.' }
}
```

- [ ] **Step 2: Criar `app/(app)/configuracoes/loja/LojaForm.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { atualizarLoja } from './actions'

export function LojaForm({ nome, logoUrl }: { nome: string; logoUrl: string | null }) {
  const [state, formAction, pending] = useActionState(atualizarLoja, undefined)

  return (
    <form
      action={formAction}
      className="max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6"
    >
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="Logo atual da Loja" className="h-16 w-16 rounded object-contain" />
      )}

      <div className="space-y-1">
        <label htmlFor="nome" className="text-sm font-medium text-slate-700">
          Nome da Loja
        </label>
        <input
          id="nome"
          name="nome"
          type="text"
          defaultValue={nome}
          required
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="logo" className="text-sm font-medium text-slate-700">
          Logo (opcional)
        </label>
        <input id="logo" name="logo" type="file" accept="image/*" className="w-full text-sm" />
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
        {pending ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Criar `app/(app)/configuracoes/loja/page.tsx`**

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { LojaForm } from './LojaForm'

export default async function LojaConfigPage() {
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

  const { data: lojaConfig, error } = await supabase
    .from('loja_config')
    .select('nome, logo_url')
    .eq('id', 1)
    .single()

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar dados da Loja: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Configurações — Loja</h1>
      <LojaForm nome={lojaConfig?.nome ?? ''} logoUrl={lojaConfig?.logo_url ?? null} />
    </div>
  )
}
```

- [ ] **Step 4: Criar `app/(app)/configuracoes/recibo/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function atualizarAssinatura(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const assinatura = formData.get('assinatura')
  if (!(assinatura instanceof File) || assinatura.size === 0) {
    return { error: 'Selecione uma imagem de assinatura.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const path = `assinaturas/${Date.now()}-${assinatura.name}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('loja-assets')
    .upload(path, assinatura, { upsert: false })

  if (uploadError) {
    return { error: `Falha ao enviar assinatura: ${uploadError.message}` }
  }

  const { data: publicUrlData } = supabaseAdmin.storage.from('loja-assets').getPublicUrl(path)

  const { data: anterior } = await supabaseAdmin
    .from('loja_config')
    .select('assinatura_url')
    .eq('id', 1)
    .single()

  const { error } = await supabaseAdmin
    .from('loja_config')
    .update({ assinatura_url: publicUrlData.publicUrl })
    .eq('id', 1)

  if (error) {
    return { error: `Falha ao salvar assinatura: ${error.message}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'EDICAO_ASSINATURA_RECIBO',
      registroTabela: 'loja_config',
      dadosAnteriores: anterior ?? null,
      dadosNovos: { assinatura_url: publicUrlData.publicUrl },
      descricao: 'Atualização da assinatura usada nos recibos',
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (assinatura atualizada com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/recibo')
  return { success: 'Assinatura atualizada com sucesso.' }
}
```

- [ ] **Step 5: Criar `app/(app)/configuracoes/recibo/AssinaturaForm.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { atualizarAssinatura } from './actions'

export function AssinaturaForm({ assinaturaUrl }: { assinaturaUrl: string | null }) {
  const [state, formAction, pending] = useActionState(atualizarAssinatura, undefined)

  return (
    <form
      action={formAction}
      className="max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-700">Cargo (fixo)</p>
        <p className="text-sm text-slate-500">Venerável Mestre</p>
      </div>

      {assinaturaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assinaturaUrl} alt="Assinatura atual" className="h-16 max-w-full object-contain" />
      )}

      <div className="space-y-1">
        <label htmlFor="assinatura" className="text-sm font-medium text-slate-700">
          Imagem da assinatura
        </label>
        <input
          id="assinatura"
          name="assinatura"
          type="file"
          accept="image/*"
          required
          className="w-full text-sm"
        />
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
        {pending ? 'Enviando...' : 'Salvar assinatura'}
      </button>
    </form>
  )
}
```

- [ ] **Step 6: Criar `app/(app)/configuracoes/recibo/page.tsx`**

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { AssinaturaForm } from './AssinaturaForm'

export default async function ReciboConfigPage() {
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

  const { data: lojaConfig, error } = await supabase
    .from('loja_config')
    .select('assinatura_url')
    .eq('id', 1)
    .single()

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar configuração de recibo: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Configurações — Recibo</h1>
      <AssinaturaForm assinaturaUrl={lojaConfig?.assinatura_url ?? null} />
    </div>
  )
}
```

- [ ] **Step 7: Typecheck e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/configuracoes/loja" "app/(app)/configuracoes/recibo"
git commit -m "feat: telas de configuração de Loja (nome/logo) e Recibo (assinatura)"
```

---

## Task 4: Mensalidade normal e Remido

**Files:**
- Create: `app/(app)/configuracoes/mensalidades/actions.ts`
- Create: `components/configuracoes/ConfigMensalidadeForm.tsx`
- Create: `app/(app)/configuracoes/mensalidades/page.tsx`
- Create: `app/(app)/configuracoes/remidos/page.tsx`

**Interfaces:**
- Consumes: `requireAdmin`, `AuthorizationError`, `createSupabaseServiceRoleClient`, `registrarAuditoria`, `validarConfigMensalidade`, `AcessoNegado`, `createSupabaseServerClient`.
- Produces: `salvarConfigMensalidade(prevState, formData): Promise<{error:string}|{success:string}|undefined>` — usada pelas duas páginas (normal e remido) via `<input type="hidden" name="tipo" value="NORMAL"|"REMIDO">`.

- [ ] **Step 1: Criar `app/(app)/configuracoes/mensalidades/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { validarConfigMensalidade } from '@/lib/domain/configuracoes'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function salvarConfigMensalidade(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const tipo = String(formData.get('tipo') ?? '')
  const valorMensalidade = Number(formData.get('valorMensalidade'))
  const valorGrandeLoja = Number(formData.get('valorGrandeLoja'))

  const validacao = validarConfigMensalidade({ tipo, valorMensalidade, valorGrandeLoja })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: criada, error } = await supabaseAdmin
    .from('config_mensalidade')
    .insert({
      tipo,
      valor_mensalidade: valorMensalidade,
      valor_grande_loja: valorGrandeLoja,
      criado_por: admin.id,
    })
    .select('id')
    .single()

  if (error || !criada) {
    return { error: `Falha ao salvar configuração: ${error?.message ?? 'erro desconhecido'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'NOVA_CONFIG_MENSALIDADE',
      registroTabela: 'config_mensalidade',
      registroId: criada.id,
      dadosNovos: { tipo, valorMensalidade, valorGrandeLoja },
      descricao: `Nova configuração de mensalidade (${tipo})`,
    })
  } catch (auditError) {
    console.error(
      'Falha ao registrar auditoria (config de mensalidade salva com sucesso):',
      auditError
    )
  }

  revalidatePath(tipo === 'NORMAL' ? '/configuracoes/mensalidades' : '/configuracoes/remidos')
  return {
    success: 'Nova configuração salva com sucesso. Vale a partir de agora para novas competências.',
  }
}
```

- [ ] **Step 2: Criar `components/configuracoes/ConfigMensalidadeForm.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { salvarConfigMensalidade } from '@/app/(app)/configuracoes/mensalidades/actions'

type ConfigHistorico = {
  id: string
  valor_mensalidade: number
  valor_grande_loja: number
  vigente_desde: string
}

export function ConfigMensalidadeForm({
  tipo,
  atual,
  historico,
}: {
  tipo: 'NORMAL' | 'REMIDO'
  atual: ConfigHistorico | null
  historico: ConfigHistorico[]
}) {
  const [state, formAction, pending] = useActionState(salvarConfigMensalidade, undefined)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Valor vigente</h2>
        {atual ? (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Valor da mensalidade</dt>
              <dd className="font-medium text-slate-900">
                {atual.valor_mensalidade.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Valor Grande Loja</dt>
              <dd className="font-medium text-slate-900">
                {atual.valor_grande_loja.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-slate-500">Nenhuma configuração cadastrada ainda.</p>
        )}
      </div>

      <form
        action={formAction}
        className="max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <h2 className="text-sm font-semibold text-slate-900">Nova configuração</h2>
        <p className="text-xs text-slate-500">
          Cadastrar uma nova configuração não altera competências já geradas — vale apenas para as
          próximas.
        </p>

        <input type="hidden" name="tipo" value={tipo} />

        <div className="space-y-1">
          <label htmlFor={`valorMensalidade-${tipo}`} className="text-sm font-medium text-slate-700">
            Valor da mensalidade (R$)
          </label>
          <input
            id={`valorMensalidade-${tipo}`}
            name="valorMensalidade"
            type="number"
            step="0.01"
            min="0"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={`valorGrandeLoja-${tipo}`} className="text-sm font-medium text-slate-700">
            Valor Grande Loja (R$)
          </label>
          <input
            id={`valorGrandeLoja-${tipo}`}
            name="valorGrandeLoja"
            type="number"
            step="0.01"
            min="0"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
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
          {pending ? 'Salvando...' : 'Salvar nova configuração'}
        </button>
      </form>

      {historico.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Vigente desde</th>
                <th className="px-4 py-2 font-medium">Mensalidade</th>
                <th className="px-4 py-2 font-medium">Grande Loja</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-slate-500">
                    {new Date(item.vigente_desde).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-2">
                    {item.valor_mensalidade.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </td>
                  <td className="px-4 py-2">
                    {item.valor_grande_loja.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
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

- [ ] **Step 3: Criar `app/(app)/configuracoes/mensalidades/page.tsx`**

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { ConfigMensalidadeForm } from '@/components/configuracoes/ConfigMensalidadeForm'

export default async function MensalidadesConfigPage() {
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

  const { data: historico, error } = await supabase
    .from('config_mensalidade')
    .select('id, valor_mensalidade, valor_grande_loja, vigente_desde')
    .eq('tipo', 'NORMAL')
    .order('vigente_desde', { ascending: false })

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar configuração: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Configurações — Mensalidade (Normal)</h1>
      <ConfigMensalidadeForm tipo="NORMAL" atual={historico[0] ?? null} historico={historico.slice(1)} />
    </div>
  )
}
```

- [ ] **Step 4: Criar `app/(app)/configuracoes/remidos/page.tsx`**

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { ConfigMensalidadeForm } from '@/components/configuracoes/ConfigMensalidadeForm'

export default async function RemidosConfigPage() {
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

  const { data: historico, error } = await supabase
    .from('config_mensalidade')
    .select('id, valor_mensalidade, valor_grande_loja, vigente_desde')
    .eq('tipo', 'REMIDO')
    .order('vigente_desde', { ascending: false })

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar configuração: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Configurações — Remidos</h1>
      <ConfigMensalidadeForm tipo="REMIDO" atual={historico[0] ?? null} historico={historico.slice(1)} />
    </div>
  )
}
```

- [ ] **Step 5: Typecheck e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/configuracoes/mensalidades" "app/(app)/configuracoes/remidos" components/configuracoes/ConfigMensalidadeForm.tsx
git commit -m "feat: telas de configuração de mensalidade normal e remidos"
```

---

## Task 5: Contas e Formas de pagamento (CRUD)

**Files:**
- Create: `app/(app)/configuracoes/contas/actions.ts`
- Create: `app/(app)/configuracoes/contas/NovaContaForm.tsx`
- Create: `app/(app)/configuracoes/contas/ContasTable.tsx`
- Create: `app/(app)/configuracoes/contas/page.tsx`
- Create: `app/(app)/configuracoes/formas-pagamento/actions.ts`
- Create: `app/(app)/configuracoes/formas-pagamento/NovaFormaPagamentoForm.tsx`
- Create: `app/(app)/configuracoes/formas-pagamento/FormasPagamentoTable.tsx`
- Create: `app/(app)/configuracoes/formas-pagamento/page.tsx`

**Interfaces:**
- Consumes: `requireAdmin`, `AuthorizationError`, `createSupabaseServiceRoleClient`, `registrarAuditoria`, `validarConta`, `validarFormaPagamento`, `AcessoNegado`, `createSupabaseServerClient`.

- [ ] **Step 1: Criar `app/(app)/configuracoes/contas/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { validarConta } from '@/lib/domain/configuracoes'

type ActionState = { error: string } | { success: string } | undefined
type DadosConta = {
  nome: string
  descricao: string
  saldoInicial: number
  dataSaldoInicial: string
  ativo: boolean
}

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function criarConta(
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
  const descricao = String(formData.get('descricao') ?? '')
  const saldoInicial = Number(formData.get('saldoInicial'))
  const dataSaldoInicial = String(formData.get('dataSaldoInicial') ?? '')

  const validacao = validarConta({ nome, saldoInicial, dataSaldoInicial })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: criada, error } = await supabaseAdmin
    .from('contas')
    .insert({
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      saldo_inicial: saldoInicial,
      data_saldo_inicial: dataSaldoInicial,
    })
    .select('id')
    .single()

  if (error || !criada) {
    return { error: `Falha ao criar conta: ${error?.message ?? 'erro desconhecido'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'CRIACAO_CONTA',
      registroTabela: 'contas',
      registroId: criada.id,
      dadosNovos: { nome: nome.trim(), descricao, saldoInicial, dataSaldoInicial },
      descricao: `Criação da conta ${nome.trim()}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (conta criada com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/contas')
  return { success: 'Conta criada com sucesso.' }
}

export async function atualizarConta(id: string, dados: DadosConta): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const validacao = validarConta(dados)
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anterior } = await supabaseAdmin
    .from('contas')
    .select('nome, descricao, saldo_inicial, data_saldo_inicial, ativo')
    .eq('id', id)
    .single()

  const { data: atualizada, error } = await supabaseAdmin
    .from('contas')
    .update({
      nome: dados.nome.trim(),
      descricao: dados.descricao.trim() || null,
      saldo_inicial: dados.saldoInicial,
      data_saldo_inicial: dados.dataSaldoInicial,
      ativo: dados.ativo,
    })
    .eq('id', id)
    .select('id')
    .single()

  if (error || !atualizada) {
    return { error: `Falha ao atualizar conta: ${error?.message ?? 'conta não encontrada'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'EDICAO_CONTA',
      registroTabela: 'contas',
      registroId: id,
      dadosAnteriores: anterior ?? null,
      dadosNovos: dados,
      descricao: `Edição da conta ${id}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (conta atualizada com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/contas')
  return {}
}
```

- [ ] **Step 2: Criar `app/(app)/configuracoes/contas/NovaContaForm.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { criarConta } from './actions'

export function NovaContaForm() {
  const [state, formAction, pending] = useActionState(criarConta, undefined)

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">Nova conta</h2>

      <div className="grid gap-4 sm:grid-cols-2">
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
          <label htmlFor="descricao" className="text-sm font-medium text-slate-700">
            Descrição (opcional)
          </label>
          <input
            id="descricao"
            name="descricao"
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="saldoInicial" className="text-sm font-medium text-slate-700">
            Saldo inicial (R$)
          </label>
          <input
            id="saldoInicial"
            name="saldoInicial"
            type="number"
            step="0.01"
            defaultValue="0"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="dataSaldoInicial" className="text-sm font-medium text-slate-700">
            Data do saldo inicial
          </label>
          <input
            id="dataSaldoInicial"
            name="dataSaldoInicial"
            type="date"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
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
        {pending ? 'Criando...' : 'Criar conta'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Criar `app/(app)/configuracoes/contas/ContasTable.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { atualizarConta } from './actions'

type Conta = {
  id: string
  nome: string
  descricao: string | null
  saldo_inicial: number
  data_saldo_inicial: string
  ativo: boolean
}

export function ContasTable({ contas }: { contas: Conta[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ id: string; message: string; isError: boolean } | null>(
    null
  )

  function handleToggleAtivo(conta: Conta) {
    const confirmMessage = conta.ativo
      ? `Desativar a conta ${conta.nome}?`
      : `Reativar a conta ${conta.nome}?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    startTransition(async () => {
      const result = await atualizarConta(conta.id, {
        nome: conta.nome,
        descricao: conta.descricao ?? '',
        saldoInicial: conta.saldo_inicial,
        dataSaldoInicial: conta.data_saldo_inicial,
        ativo: !conta.ativo,
      })
      setFeedback({
        id: conta.id,
        message: result.error ?? 'Status atualizado.',
        isError: Boolean(result.error),
      })
    })
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Nome</th>
            <th className="px-4 py-2 font-medium">Saldo inicial</th>
            <th className="px-4 py-2 font-medium">Data do saldo</th>
            <th className="px-4 py-2 font-medium">Situação</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {contas.map((conta) => (
            <tr key={conta.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2">
                {editingId === conta.id ? (
                  <EditForm
                    conta={conta}
                    pending={isPending}
                    onCancel={() => setEditingId(null)}
                    onSave={(dados) => {
                      startTransition(async () => {
                        const result = await atualizarConta(conta.id, dados)
                        setFeedback({
                          id: conta.id,
                          message: result.error ?? 'Conta atualizada.',
                          isError: Boolean(result.error),
                        })
                        if (!result.error) {
                          setEditingId(null)
                        }
                      })
                    }}
                  />
                ) : (
                  <>
                    <div className="font-medium text-slate-900">{conta.nome}</div>
                    {conta.descricao && <div className="text-xs text-slate-500">{conta.descricao}</div>}
                  </>
                )}
              </td>
              <td className="px-4 py-2">
                {editingId === conta.id
                  ? '—'
                  : conta.saldo_inicial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
              <td className="px-4 py-2">
                {editingId === conta.id ? '—' : new Date(conta.data_saldo_inicial).toLocaleDateString('pt-BR')}
              </td>
              <td className="px-4 py-2">
                <span className={conta.ativo ? 'text-green-700' : 'text-slate-400'}>
                  {conta.ativo ? 'Ativa' : 'Inativa'}
                </span>
              </td>
              <td className="space-x-2 px-4 py-2">
                {editingId !== conta.id && (
                  <button
                    type="button"
                    onClick={() => setEditingId(conta.id)}
                    className="text-slate-700 underline"
                  >
                    Editar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleToggleAtivo(conta)}
                  disabled={isPending}
                  className="text-slate-700 underline disabled:opacity-50"
                >
                  {conta.ativo ? 'Desativar' : 'Reativar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {feedback && (
        <p
          className={`px-4 py-2 text-sm ${feedback.isError ? 'text-red-600' : 'text-green-700'}`}
          role={feedback.isError ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      )}
    </div>
  )
}

function EditForm({
  conta,
  pending,
  onSave,
  onCancel,
}: {
  conta: Conta
  pending: boolean
  onSave: (dados: {
    nome: string
    descricao: string
    saldoInicial: number
    dataSaldoInicial: string
    ativo: boolean
  }) => void
  onCancel: () => void
}) {
  const [nome, setNome] = useState(conta.nome)
  const [descricao, setDescricao] = useState(conta.descricao ?? '')
  const [saldoInicial, setSaldoInicial] = useState(String(conta.saldo_inicial))
  const [dataSaldoInicial, setDataSaldoInicial] = useState(conta.data_saldo_inicial)

  return (
    <div className="space-y-2">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome"
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <input
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Descrição"
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <input
        type="number"
        step="0.01"
        value={saldoInicial}
        onChange={(e) => setSaldoInicial(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <input
        type="date"
        value={dataSaldoInicial}
        onChange={(e) => setDataSaldoInicial(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <div className="space-x-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            onSave({
              nome,
              descricao,
              saldoInicial: Number(saldoInicial),
              dataSaldoInicial,
              ativo: conta.ativo,
            })
          }
          className="text-sm text-slate-900 underline disabled:opacity-50"
        >
          Salvar
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 underline">
          Cancelar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Criar `app/(app)/configuracoes/contas/page.tsx`**

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { NovaContaForm } from './NovaContaForm'
import { ContasTable } from './ContasTable'

export default async function ContasConfigPage() {
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

  const { data: contas, error } = await supabase
    .from('contas')
    .select('id, nome, descricao, saldo_inicial, data_saldo_inicial, ativo')
    .order('nome')

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar contas: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Configurações — Contas</h1>
      <NovaContaForm />
      {contas.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma conta cadastrada.</p>
      ) : (
        <ContasTable contas={contas} />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Criar `app/(app)/configuracoes/formas-pagamento/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { validarFormaPagamento } from '@/lib/domain/configuracoes'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function criarFormaPagamento(
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
  const validacao = validarFormaPagamento({ nome })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: criada, error } = await supabaseAdmin
    .from('formas_pagamento')
    .insert({ nome: nome.trim() })
    .select('id')
    .single()

  if (error || !criada) {
    return { error: `Falha ao criar forma de pagamento: ${error?.message ?? 'erro desconhecido'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'CRIACAO_FORMA_PAGAMENTO',
      registroTabela: 'formas_pagamento',
      registroId: criada.id,
      dadosNovos: { nome: nome.trim() },
      descricao: `Criação da forma de pagamento ${nome.trim()}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (forma de pagamento criada com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/formas-pagamento')
  return { success: 'Forma de pagamento criada com sucesso.' }
}

export async function atualizarFormaPagamento(
  id: string,
  dados: { nome: string; ativo: boolean }
): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const validacao = validarFormaPagamento(dados)
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anterior } = await supabaseAdmin
    .from('formas_pagamento')
    .select('nome, ativo')
    .eq('id', id)
    .single()

  const { data: atualizada, error } = await supabaseAdmin
    .from('formas_pagamento')
    .update({ nome: dados.nome.trim(), ativo: dados.ativo })
    .eq('id', id)
    .select('id')
    .single()

  if (error || !atualizada) {
    return { error: `Falha ao atualizar forma de pagamento: ${error?.message ?? 'não encontrada'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'EDICAO_FORMA_PAGAMENTO',
      registroTabela: 'formas_pagamento',
      registroId: id,
      dadosAnteriores: anterior ?? null,
      dadosNovos: dados,
      descricao: `Edição da forma de pagamento ${id}`,
    })
  } catch (auditError) {
    console.error(
      'Falha ao registrar auditoria (forma de pagamento atualizada com sucesso):',
      auditError
    )
  }

  revalidatePath('/configuracoes/formas-pagamento')
  return {}
}
```

- [ ] **Step 6: Criar `app/(app)/configuracoes/formas-pagamento/NovaFormaPagamentoForm.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { criarFormaPagamento } from './actions'

export function NovaFormaPagamentoForm() {
  const [state, formAction, pending] = useActionState(criarFormaPagamento, undefined)

  return (
    <form action={formAction} className="max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">Nova forma de pagamento</h2>

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
        {pending ? 'Criando...' : 'Criar'}
      </button>
    </form>
  )
}
```

- [ ] **Step 7: Criar `app/(app)/configuracoes/formas-pagamento/FormasPagamentoTable.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { atualizarFormaPagamento } from './actions'

type FormaPagamento = {
  id: string
  nome: string
  ativo: boolean
}

export function FormasPagamentoTable({ formas }: { formas: FormaPagamento[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ id: string; message: string; isError: boolean } | null>(
    null
  )

  function handleToggleAtivo(forma: FormaPagamento) {
    const confirmMessage = forma.ativo
      ? `Desativar a forma de pagamento ${forma.nome}?`
      : `Reativar a forma de pagamento ${forma.nome}?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    startTransition(async () => {
      const result = await atualizarFormaPagamento(forma.id, { nome: forma.nome, ativo: !forma.ativo })
      setFeedback({
        id: forma.id,
        message: result.error ?? 'Status atualizado.',
        isError: Boolean(result.error),
      })
    })
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Nome</th>
            <th className="px-4 py-2 font-medium">Situação</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {formas.map((forma) => (
            <tr key={forma.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2">
                {editingId === forma.id ? (
                  <EditForm
                    forma={forma}
                    pending={isPending}
                    onCancel={() => setEditingId(null)}
                    onSave={(nome) => {
                      startTransition(async () => {
                        const result = await atualizarFormaPagamento(forma.id, {
                          nome,
                          ativo: forma.ativo,
                        })
                        setFeedback({
                          id: forma.id,
                          message: result.error ?? 'Forma de pagamento atualizada.',
                          isError: Boolean(result.error),
                        })
                        if (!result.error) {
                          setEditingId(null)
                        }
                      })
                    }}
                  />
                ) : (
                  forma.nome
                )}
              </td>
              <td className="px-4 py-2">
                <span className={forma.ativo ? 'text-green-700' : 'text-slate-400'}>
                  {forma.ativo ? 'Ativa' : 'Inativa'}
                </span>
              </td>
              <td className="space-x-2 px-4 py-2">
                {editingId !== forma.id && (
                  <button
                    type="button"
                    onClick={() => setEditingId(forma.id)}
                    className="text-slate-700 underline"
                  >
                    Editar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleToggleAtivo(forma)}
                  disabled={isPending}
                  className="text-slate-700 underline disabled:opacity-50"
                >
                  {forma.ativo ? 'Desativar' : 'Reativar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {feedback && (
        <p
          className={`px-4 py-2 text-sm ${feedback.isError ? 'text-red-600' : 'text-green-700'}`}
          role={feedback.isError ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      )}
    </div>
  )
}

function EditForm({
  forma,
  pending,
  onSave,
  onCancel,
}: {
  forma: FormaPagamento
  pending: boolean
  onSave: (nome: string) => void
  onCancel: () => void
}) {
  const [nome, setNome] = useState(forma.nome)

  return (
    <div className="space-y-2">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <div className="space-x-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => onSave(nome)}
          className="text-sm text-slate-900 underline disabled:opacity-50"
        >
          Salvar
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 underline">
          Cancelar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Criar `app/(app)/configuracoes/formas-pagamento/page.tsx`**

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { NovaFormaPagamentoForm } from './NovaFormaPagamentoForm'
import { FormasPagamentoTable } from './FormasPagamentoTable'

export default async function FormasPagamentoConfigPage() {
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

  const { data: formas, error } = await supabase
    .from('formas_pagamento')
    .select('id, nome, ativo')
    .order('nome')

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar formas de pagamento: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Configurações — Formas de pagamento</h1>
      <NovaFormaPagamentoForm />
      {formas.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma forma de pagamento cadastrada.</p>
      ) : (
        <FormasPagamentoTable formas={formas} />
      )}
    </div>
  )
}
```

- [ ] **Step 9: Typecheck, lint e build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 10: Commit**

```bash
git add "app/(app)/configuracoes/contas" "app/(app)/configuracoes/formas-pagamento"
git commit -m "feat: telas de configuração de contas e formas de pagamento (CRUD)"
```

---

## Task 6: Hub de Configurações, documentação e checagem final

**Files:**
- Modify: `app/(app)/configuracoes/page.tsx` (habilitar os links agora existentes)
- Modify: `docs/banco.md` (documentar a coluna `assinatura_url` e o bucket `loja-assets`)
- Modify: `docs/arquitetura.md` (árvore de pastas)
- Modify: `docs/permissoes.md` (adicionar módulo Configurações à matriz, se ainda não coberto)

- [ ] **Step 1: Atualizar `app/(app)/configuracoes/page.tsx`**

Ler o arquivo atual (criado na Fase 3) antes de editar. Trocar o array `SECOES` para habilitar todos os hrefs agora implementados:

```tsx
const SECOES = [
  { titulo: 'Usuários', href: '/configuracoes/usuarios', apenasAdmin: true },
  { titulo: 'Loja', href: '/configuracoes/loja', apenasAdmin: true },
  { titulo: 'Mensalidades', href: '/configuracoes/mensalidades', apenasAdmin: true },
  { titulo: 'Remidos', href: '/configuracoes/remidos', apenasAdmin: true },
  { titulo: 'Contas', href: '/configuracoes/contas', apenasAdmin: true },
  { titulo: 'Formas de pagamento', href: '/configuracoes/formas-pagamento', apenasAdmin: true },
  { titulo: 'Recibo', href: '/configuracoes/recibo', apenasAdmin: true },
] as const
```

Manter o resto do arquivo (lógica de `isAdmin`, renderização condicional) sem alteração — só o array muda.

- [ ] **Step 2: Atualizar `docs/banco.md`**

Adicionar, na seção de `loja_config` já existente (criada na Fase 2), uma nota sobre a coluna `assinatura_url` (adicionada na migration `00000000000016`) e sobre o bucket de Storage `loja-assets` (público para leitura, escrita restrita a `is_admin()`), explicando que uploads acontecem via Server Action com `service_role`, nunca diretamente do client.

- [ ] **Step 3: Atualizar `docs/arquitetura.md`**

Adicionar à árvore de pastas: `supabase/migrations/00000000000016_loja_assets.sql`, `app/(app)/configuracoes/{loja,mensalidades,remidos,contas,formas-pagamento,recibo}/*`, `components/configuracoes/ConfigMensalidadeForm.tsx`.

- [ ] **Step 4: Atualizar `docs/permissoes.md`**

Confirmar que a matriz de permissões já cobre "Configurações" (deve cobrir, já que Fase 3 documentou "Usuários" sob esse módulo) — se a linha genérica de Configurações não mencionar explicitamente Loja/Mensalidade/Remido/Contas/Formas de pagamento/Recibo como restritos a Administrador, adicionar essa cobertura.

- [ ] **Step 5: Checagem final**

Rodar, na ordem, e confirmar que tudo passa:

```bash
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/configuracoes/page.tsx" docs/banco.md docs/arquitetura.md docs/permissoes.md
git commit -m "feat: habilita hub de Configurações e atualiza documentação da Fase 4"
```

---

## Self-Review (spec coverage)

- Loja (nome + logo) — SPEC §28 → Task 3. ✅
- Mensalidade normal (valor + valor Grande Loja) — SPEC §28/§9 → Task 4. ✅
- Remido (valor + valor Grande Loja) — SPEC §28/§9 → Task 4. ✅
- Recibo (assinatura, cargo fixo Venerável Mestre) — SPEC §28/§27 → Task 3. ✅
- Contas (CRUD) — SPEC §28/§18 → Task 5. ✅
- Formas de pagamento (CRUD) — SPEC §28/§19 → Task 5. ✅
- Usuários (CRUD administrativo) — já entregue na Fase 3, não repetido aqui. ✅
- Histórico preservado ao alterar configuração de mensalidade (SPEC §9: "Se a configuração mudar posteriormente, competências antigas permanecem inalteradas") — `config_mensalidade` é append-only desde a Fase 2; a Server Action só insere, nunca edita (Task 4). ✅
- Toda tela restrita a Administrador, com auditoria — todas as Tasks. ✅
- Nenhuma tabela ganha delete físico — Contas e Formas de pagamento só têm toggle `ativo` (Task 5). ✅
- Módulos fora de escopo (membros, mensalidades/pagamentos de membros, financeiro, campanhas, Grande Loja, relatórios) — não tocados, conforme fases seguintes.

## Pendência conhecida (não bloqueia a fase)

Upload de logo/assinatura para o bucket `loja-assets` só pode ser validado contra o projeto Supabase real (a migration cria o bucket, mas o teste de upload/exibição de imagem exige um teste manual). Isso deve ser reportado como pendência de validação ao final, junto com a criação de uma conta e uma forma de pagamento de teste pela UI.
