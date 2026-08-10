# Fase 1 — Fundação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabelecer a fundação do Sistema de Gestão da Loja Maçônica: projeto Next.js/TypeScript/Tailwind, integração Supabase (client/server), autenticação por username+senha sobre Supabase Auth, layout principal (sidebar/header/tema), proteção de rotas, e estrutura inicial de autorização (perfis ADMINISTRADOR/TESOUREIRO/CONSULTA). Nenhum módulo de negócio (membros, mensalidades, financeiro, etc.) é implementado nesta fase.

**Architecture:** Next.js App Router. Camada de domínio pura em `lib/domain/` (sem I/O) para regras testáveis isoladamente — nesta fase, só o mapeamento username→email interno. Toda leitura de sessão/perfil e toda escrita (login/logout) passam por Server Actions/Server Components; nenhuma lógica de autorização no client. RLS habilitada desde já na tabela `profiles`, com policy mínima.

**Tech Stack:** Next.js (App Router) + TypeScript estrito, Tailwind CSS, @supabase/ssr + @supabase/supabase-js, Supabase CLI (migrations), Vitest para testes unitários de domínio.

## Global Constraints

- Nenhuma senha própria armazenada em tabela da aplicação (SPEC princípio 11).
- Nenhuma secret do Supabase exposta no frontend — só `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` podem ser client-side; `SUPABASE_SERVICE_ROLE_KEY` nunca é importada por código client (SPEC princípio 12).
- Autorização deve ser validada no servidor, nunca só na interface (SPEC princípio 10).
- Migrations versionadas em `supabase/migrations/`, nunca editar uma já aplicada (SPEC princípio 13, CLAUDE.md §6).
- TypeScript estrito (`strict: true`), sem `any` não justificado (CLAUDE.md §17).
- Sem mocks permanentes, sem botão falso (SPEC princípios 14-15).
- Commits pequenos e descritivos; nunca commitar `.env*` com segredos reais (CLAUDE.md §19).

---

## Contexto para quem for executar

- Este é um projeto **novo** — o diretório `D:\DEV\Sistema Maçonaria` hoje só tem `CLAUDE.md`, `SPEC_Loja_Maconica.md`, `PROMPT_INICIAL.md` e este plano. Não há `.git` ainda.
- O usuário **ainda não criou** o projeto Supabase. Todo código deve rodar/compilar sem credenciais reais (build e typecheck não dependem de rede). O `.env.local` com credenciais reais é responsabilidade do usuário; nós só entregamos `.env.example` documentado.
- Sem projeto Supabase real, o teste manual do login (via browser) **não pode ser concluído nesta sessão** — isso deve ser reportado como pendência explícita ao final da fase, não escondido.
- Convenção de e-mail interno para Supabase Auth: `<username>@loja.internal` (domínio fixo, não configurável nesta fase). Isso satisfaz a exigência do Supabase Auth de um identificador tipo e-mail, sem expor e-mails reais nem exigir que o usuário tenha um.

---

## Task 1: Inicializar projeto Next.js + TypeScript + Tailwind + git

**Files:**
- Create: projeto Next.js completo na raiz de `D:\DEV\Sistema Maçonaria` (via `create-next-app`)
- Create: `.gitignore` (gerado pelo create-next-app, revisar)
- Create: `.env.example`
- Create: `README.md`

**Interfaces:**
- Produces: projeto Next.js rodável com `npm run dev`, `npm run build`, `npm run lint`, TypeScript strict habilitado.

- [ ] **Step 1: Inicializar git**

```bash
cd "D:/DEV/Sistema Maçonaria"
git init
git add CLAUDE.md SPEC_Loja_Maconica.md PROMPT_INICIAL.md docs
git commit -m "chore: initial docs (SPEC, CLAUDE.md, plano Fase 1)"
```

- [ ] **Step 2: Criar projeto Next.js na raiz atual**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm --no-turbopack
```

Se o CLI perguntar sobre diretório não vazio, confirmar (os `.md` existentes devem ser preservados).

- [ ] **Step 3: Confirmar TypeScript estrito**

Abrir `tsconfig.json` e garantir `"strict": true` (o template do Next.js já vem assim — só confirmar, não sobrescrever outras opções).

- [ ] **Step 4: Criar `.env.example`**

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 5: Rodar build para validar scaffold**

Run: `npm run build`
Expected: build concluído sem erros (páginas padrão do template).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + TypeScript + Tailwind"
```

---

## Task 2: Instalar dependências e configurar clientes Supabase

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Modify: `package.json` (dependências)

**Interfaces:**
- Produces: `createSupabaseBrowserClient(): SupabaseClient` (uso em Client Components), `createSupabaseServerClient(): Promise<SupabaseClient>` (uso em Server Components/Actions, lê cookies do Next).
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` de `process.env`.

- [ ] **Step 1: Instalar dependências**

```bash
npm install @supabase/supabase-js @supabase/ssr zod
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 2: Criar `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Criar `lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // chamado de um Server Component sem permissão de escrita de cookie;
            // o middleware cuida do refresh de sessão nesse caso.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: clientes Supabase (browser/server)"
```

---

## Task 3: Migration `profiles` + vínculo com auth.users + RLS

**Files:**
- Create: `supabase/migrations/00000000000001_profiles.sql`
- Create: `docs/banco.md`

**Interfaces:**
- Produces: tabela `public.profiles(id uuid PK references auth.users, username text unique, nome text, role text check in ('ADMINISTRADOR','TESOUREIRO','CONSULTA'), ativo boolean default true, created_at, updated_at)`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/00000000000001_profiles.sql

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  nome text not null,
  role text not null check (role in ('ADMINISTRADOR', 'TESOUREIRO', 'CONSULTA')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_username_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

-- qualquer usuário autenticado e ativo pode ler perfis (necessário para exibir
-- "quem registrou" em módulos futuros e para o próprio header)
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- ninguém escreve em profiles via client; administração de usuários (Fase 3)
-- passa por Server Action com service role, não por INSERT/UPDATE direto do cliente.
-- Nenhuma policy de insert/update/delete é criada aqui de propósito.

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Documentar em `docs/banco.md`**

Criar o arquivo com uma seção "Tabela profiles" descrevendo campos, a decisão de RLS somente-leitura para authenticated, e a nota de que administração de usuários (INSERT/UPDATE/DELETE) fica centralizada em Server Action com service role — decisão técnica documentada por não estar detalhada no SPEC (autorizado por CLAUDE.md §20 "decisão puramente técnica").

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(db): migration inicial de profiles com RLS"
```

Nota: a migration só pode ser **aplicada** contra um projeto Supabase real quando o usuário fornecer credenciais (`supabase db push` ou SQL Editor). Isso fica registrado como pendência ao final da fase.

---

## Task 4: Domínio de autenticação — mapeamento username→email interno

**Files:**
- Create: `lib/domain/auth.ts`
- Test: `lib/domain/auth.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces: `usernameToAuthEmail(username: string): string`, `normalizeUsername(username: string): string`.
- Consumes: nada (função pura).

- [ ] **Step 1: Configurar Vitest**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

Adicionar em `package.json`: `"test": "vitest run"`.

- [ ] **Step 2: Escrever o teste que falha primeiro**

```typescript
// lib/domain/auth.test.ts
import { describe, expect, it } from 'vitest'
import { normalizeUsername, usernameToAuthEmail } from './auth'

describe('normalizeUsername', () => {
  it('remove espaços e converte para minúsculas', () => {
    expect(normalizeUsername('  Joao.Silva ')).toBe('joao.silva')
  })
})

describe('usernameToAuthEmail', () => {
  it('gera e-mail interno determinístico a partir do username', () => {
    expect(usernameToAuthEmail('Joao.Silva')).toBe('joao.silva@loja.internal')
  })

  it('rejeita username vazio', () => {
    expect(() => usernameToAuthEmail('   ')).toThrow('username inválido')
  })
})
```

- [ ] **Step 3: Rodar e confirmar falha**

Run: `npx vitest run lib/domain/auth.test.ts`
Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 4: Implementar**

```typescript
// lib/domain/auth.ts
const INTERNAL_EMAIL_DOMAIN = 'loja.internal'

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

export function usernameToAuthEmail(username: string): string {
  const normalized = normalizeUsername(username)
  if (normalized.length === 0) {
    throw new Error('username inválido')
  }
  return `${normalized}@${INTERNAL_EMAIL_DOMAIN}`
}
```

- [ ] **Step 5: Rodar e confirmar sucesso**

Run: `npx vitest run lib/domain/auth.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: mapeamento username->email interno com testes"
```

---

## Task 5: Página de login + Server Actions de login/logout

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/login/actions.ts`
- Modify: `app/globals.css` (se necessário paleta base)

**Interfaces:**
- Consumes: `usernameToAuthEmail` (Task 4), `createSupabaseServerClient` (Task 2).
- Produces: Server Action `signIn(formData: FormData): Promise<{ error: string } | void>` que redireciona para `/dashboard` em sucesso; Server Action `signOut(): Promise<void>` que redireciona para `/login`.

- [ ] **Step 1: Criar `app/login/actions.ts`**

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { usernameToAuthEmail } from '@/lib/domain/auth'

export async function signIn(
  _prevState: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string } | undefined> {
  const username = String(formData.get('username') ?? '')
  const password = String(formData.get('password') ?? '')

  if (!username || !password) {
    return { error: 'Informe usuário e senha.' }
  }

  let email: string
  try {
    email = usernameToAuthEmail(username)
  } catch {
    return { error: 'Usuário inválido.' }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Usuário ou senha inválidos.' }
  }

  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 2: Criar `app/login/page.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { signIn } from './actions'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, undefined)

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow"
      >
        <h1 className="text-xl font-semibold text-slate-900">
          Sistema Loja Maçônica
        </h1>

        <div className="space-y-1">
          <label htmlFor="username" className="text-sm font-medium text-slate-700">
            Usuário
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-slate-700">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: tela de login com Server Action de autenticação"
```

---

## Task 6: Middleware de proteção de rotas

**Files:**
- Create: `middleware.ts`
- Create: `lib/supabase/middleware.ts`

**Interfaces:**
- Consumes: `@supabase/ssr` `createServerClient`.
- Produces: comportamento — rota fora de `/login` sem sessão válida → redirect `/login`; `/login` com sessão válida → redirect `/dashboard`.

- [ ] **Step 1: Criar `lib/supabase/middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginRoute = request.nextUrl.pathname.startsWith('/login')

  if (!user && !isLoginRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}
```

- [ ] **Step 2: Criar `middleware.ts` na raiz**

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: middleware de proteção de rotas via Supabase Auth"
```

---

## Task 7: Layout principal (sidebar, header, tema) + dashboard placeholder

**Files:**
- Modify: `app/layout.tsx` (root layout mínimo, sem sidebar — só html/body/fonts)
- Create: `app/(app)/layout.tsx` (layout autenticado com sidebar+header)
- Create: `app/(app)/dashboard/page.tsx`
- Create: `components/layout/Sidebar.tsx`
- Create: `components/layout/Header.tsx`
- Modify: `app/login/page.tsx` → mover para fora do grupo `(app)` (já está fora, sem alteração de path)

**Interfaces:**
- Consumes: `createSupabaseServerClient` (Task 2), `signOut` action (Task 5).
- Produces: layout `(app)` que busca `profiles` do usuário logado e passa `{ nome, role }` para `Header`.

- [ ] **Step 1: Criar `components/layout/Sidebar.tsx`**

```tsx
import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/membros', label: 'Membros' },
  { href: '/mensalidades', label: 'Mensalidades' },
  { href: '/campanhas', label: 'Campanhas' },
  { href: '/financeiro', label: 'Financeiro' },
  { href: '/grande-loja', label: 'Grande Loja' },
  { href: '/recibos', label: 'Recibos' },
  { href: '/relatorios', label: 'Relatórios' },
  { href: '/configuracoes', label: 'Configurações' },
] as const

export function Sidebar() {
  return (
    <nav className="w-60 shrink-0 border-r border-slate-200 bg-white p-4">
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

Nota: os módulos ainda não implementados (`/membros`, `/mensalidades` etc.) ficam como links que levam a rotas 404 nesta fase — não criamos página fake para eles. Isso é aceitável por não serem "botões" dentro de uma tela de negócio incompleta, e sim navegação estrutural do shell; ainda assim, para não deixar link morto, cada rota recebe uma page mínima "Em desenvolvimento" (ver Step 2).

- [ ] **Step 2: Criar páginas placeholder explícitas para os módulos futuros**

Para cada item de `NAV_ITEMS` exceto `/dashboard`, criar `app/(app)/<rota>/page.tsx`:

```tsx
export default function EmDesenvolvimentoPage() {
  return (
    <div className="rounded border border-dashed border-slate-300 p-8 text-center text-slate-500">
      <p className="font-medium">Módulo em desenvolvimento</p>
      <p className="text-sm">Esta funcionalidade será implementada em uma fase futura do projeto.</p>
    </div>
  )
}
```

(Arquivos: `app/(app)/membros/page.tsx`, `app/(app)/mensalidades/page.tsx`, `app/(app)/campanhas/page.tsx`, `app/(app)/financeiro/page.tsx`, `app/(app)/grande-loja/page.tsx`, `app/(app)/recibos/page.tsx`, `app/(app)/relatorios/page.tsx`, `app/(app)/configuracoes/page.tsx` — mesmo conteúdo, cada um com seu próprio arquivo.)

- [ ] **Step 3: Criar `components/layout/Header.tsx`**

```tsx
import { signOut } from '@/app/login/actions'

type HeaderProps = {
  nome: string
  role: string
}

export function Header({ nome, role }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <span className="font-semibold text-slate-900">Loja Maçônica</span>
      <div className="flex items-center gap-4">
        <div className="text-right text-sm">
          <p className="font-medium text-slate-900">{nome}</p>
          <p className="text-slate-500">{role}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Sair
          </button>
        </form>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Criar `app/(app)/layout.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header nome={profile?.nome ?? user.email ?? ''} role={profile?.role ?? ''} />
        <main className="flex-1 bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Criar `app/(app)/dashboard/page.tsx`**

```tsx
export default function DashboardPage() {
  return (
    <div className="rounded border border-dashed border-slate-300 p-8 text-center text-slate-500">
      <p className="font-medium">Dashboard</p>
      <p className="text-sm">Os cards e gráficos com dados reais serão implementados na Fase 12.</p>
    </div>
  )
}
```

- [ ] **Step 6: Ajustar `app/page.tsx`** para redirecionar `/` → `/dashboard`

```tsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/dashboard')
}
```

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: build concluído sem erros (chamadas ao Supabase falharão em runtime sem credenciais reais, mas o build estático/tipagem deve passar).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: layout autenticado (sidebar/header), rotas placeholder e dashboard shell"
```

---

## Task 8: Documentação e checagem final da fase

**Files:**
- Create: `docs/arquitetura.md`
- Create: `docs/instalacao.md`
- Modify: `README.md`
- Modify: `docs/banco.md` (já criado na Task 3)

**Interfaces:**
- N/A (documentação).

- [ ] **Step 1: `docs/arquitetura.md`** — resumir a estrutura de pastas da Task 1 desta plano e o fluxo de autenticação (username → e-mail interno → Supabase Auth → cookie de sessão → middleware → RLS).

- [ ] **Step 2: `docs/instalacao.md`** — passos para rodar localmente: `npm install`, criar `.env.local` a partir de `.env.example`, criar projeto Supabase, `supabase db push` para aplicar `supabase/migrations/`, criar manualmente o primeiro usuário ADMINISTRADOR (via SQL Editor: criar em `auth.users` + `profiles`, já que a Fase 3 ainda não implementa CRUD de usuários).

- [ ] **Step 3: Atualizar `README.md`** com visão geral do projeto, stack, e link para `docs/`.

- [ ] **Step 4: Rodar checagem completa**

```bash
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```

Expected: todos passam sem erro. Corrigir qualquer falha antes de prosseguir.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "docs: arquitetura, instalação e README da Fase 1"
```

---

## Self-Review (spec coverage)

- Projeto Next.js/TS/Tailwind/estrutura base → Task 1. ✅
- Configuração Supabase → Task 2, 3. ✅
- Variáveis de ambiente → Task 1 (`.env.example`), documentado em Task 8. ✅
- Layout principal, sidebar, header, tema → Task 7. ✅
- Login → Task 5. ✅
- Proteção de rotas → Task 6. ✅
- Estrutura inicial de autorização (perfis) → Task 3 (tabela `profiles` + `role`), consumida no Header (Task 7); enforcement completo de permissão por ação fica para os módulos de negócio nas fases seguintes, conforme escopo da Fase 1 do SPEC (§37) que não inclui ainda telas administrativas.
- Mensalidades/financeiro/campanhas/Grande Loja/relatórios → explicitamente **fora de escopo** desta fase, conforme PROMPT_INICIAL.md.

## Pendência conhecida (não bloqueia a fase)

Login e RLS só podem ser testados ponta-a-ponta em um projeto Supabase real. Ao final da Fase 1, isso deve ser reportado como pendência: "aplicar migrations e criar primeiro usuário ADMINISTRADOR assim que o usuário fornecer credenciais Supabase".
