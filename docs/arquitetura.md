# Arquitetura — Fase 1 (Fundação)

## Overview

Este documento descreve a estrutura de pastas e o fluxo de autenticação implementados na Fase 1 do sistema. Para o schema do banco de dados e políticas de RLS, ver [`docs/banco.md`](./banco.md).

---

## Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript** (modo estrito).
- **Tailwind CSS 4** para estilos.
- **Supabase** (PostgreSQL + Supabase Auth) como backend.
- **Vitest** para testes unitários.
- **ESLint** (`eslint-config-next`) para lint.

---

## Estrutura de pastas

```
.
├── app/
│   ├── layout.tsx                # Layout raiz (fonte, html/body)
│   ├── page.tsx                  # Rota "/" (redireciona incondicionalmente para /dashboard; o middleware trata o redirect para /login quando não há sessão)
│   ├── login/
│   │   ├── page.tsx              # Tela de login (formulário username/senha)
│   │   └── actions.ts            # Server Actions: signIn(), signOut()
│   └── (app)/                    # Route group autenticado
│       ├── layout.tsx            # Verifica sessão, carrega profile, monta Sidebar+Header
│       ├── dashboard/page.tsx
│       ├── membros/page.tsx      # Placeholder (Fase 2)
│       ├── mensalidades/page.tsx # Placeholder (Fase 2)
│       ├── campanhas/page.tsx    # Placeholder (fase futura)
│       ├── financeiro/page.tsx   # Placeholder (fase futura)
│       ├── grande-loja/page.tsx  # Placeholder (fase futura)
│       ├── recibos/page.tsx      # Placeholder (fase futura)
│       ├── relatorios/page.tsx   # Placeholder (fase futura)
│       └── configuracoes/page.tsx# Placeholder (fase futura)
├── components/
│   └── layout/
│       ├── Sidebar.tsx           # Navegação lateral fixa (links para os módulos)
│       └── Header.tsx            # Cabeçalho: nome/role do usuário logado + botão Sair
├── lib/
│   ├── domain/
│   │   ├── auth.ts               # normalizeUsername(), usernameToAuthEmail()
│   │   └── auth.test.ts          # Testes unitários do mapeamento username→email
│   └── supabase/
│       ├── client.ts             # createSupabaseBrowserClient() — uso em Client Components
│       ├── server.ts             # createSupabaseServerClient() — uso em Server Components/Actions
│       └── middleware.ts         # updateSession() — validação/refresh de sessão a cada request
├── proxy.ts                      # Proxy do Next.js (antigo middleware.ts), delega para lib/supabase/middleware.ts
├── supabase/
│   ├── migrations/
│   │   └── 00000000000001_profiles.sql  # Tabela profiles + RLS + trigger updated_at
│   └── seed.sql                  # dados de desenvolvimento (formas de pagamento padrão, config inicial da loja)
├── docs/
│   ├── arquitetura.md            # Este arquivo
│   ├── banco.md                  # Schema, RLS, constraints, decisões de design
│   └── instalacao.md             # Passo a passo de setup local
├── SPEC_Loja_Maconica.md         # Especificação funcional/técnica (fonte de verdade)
├── CLAUDE.md                     # Regras permanentes de desenvolvimento
├── PROMPT_INICIAL.md             # Roadmap/fases do projeto
└── .env.example                  # Variáveis de ambiente necessárias
```

Não existem ainda camadas de `services/`, `repositories/` ou APIs REST customizadas — toda a lógica de servidor da Fase 1 está em Server Actions (`app/login/actions.ts`) e em funções puras de domínio (`lib/domain/`). Módulos de negócio das fases seguintes devem seguir o mesmo padrão: regra de domínio isolada em `lib/domain/`, acesso a dados via Supabase client apropriado (`server.ts` no servidor, `client.ts` no browser).

---

## Fluxo de autenticação

O sistema usa **username + senha** na interface, mas a autenticação real é feita pelo Supabase Auth, que trabalha com e-mail. Não existe tabela própria de senhas — ver `CLAUDE.md` §11.

Passo a passo:

1. **Usuário digita username e senha** em `/login` (`app/login/page.tsx`), um formulário que invoca a Server Action `signIn` (`app/login/actions.ts`) via `useActionState`/`action`.

2. **Mapeamento username → e-mail interno.** `signIn()` chama `usernameToAuthEmail(username)` em `lib/domain/auth.ts`, que normaliza o username (`trim` + `lowercase`) e monta `"<username>@loja.internal"`. Esse domínio fictício existe apenas para satisfazer o requisito de e-mail do Supabase Auth — o usuário nunca vê nem usa esse e-mail.

3. **Autenticação no Supabase Auth.** `signIn()` cria um client Supabase de servidor (`createSupabaseServerClient()`, `lib/supabase/server.ts`) e chama `supabase.auth.signInWithPassword({ email, password })`. Em caso de erro, retorna `{ error: 'Usuário ou senha inválidos.' }` para o formulário (mensagem genérica, sem revelar se o problema foi o username ou a senha).

4. **Cookie de sessão.** O client de servidor (`@supabase/ssr`) grava os cookies de sessão (access/refresh token) na resposta via `cookieStore.set()`. Em caso de sucesso, `signIn()` redireciona para `/dashboard`.

5. **Proxy (middleware) valida a sessão a cada request.** `proxy.ts` (raiz — o antigo `middleware.ts`, renomeado por conta da convenção introduzida no Next.js 16) delega para `updateSession()` em `lib/supabase/middleware.ts`, que roda em todo request (exceto assets estáticos, conforme `config.matcher`). Ele:
   - cria um client Supabase de servidor ligado aos cookies do request/response;
   - chama `supabase.auth.getUser()` para validar/renovar a sessão;
   - se não há usuário autenticado e a rota não é `/login`, redireciona para `/login`;
   - se há usuário autenticado e a rota é `/login`, redireciona para `/dashboard`;
   - propaga os cookies atualizados (refresh de token) tanto na resposta normal quanto nos redirects.

6. **Layout autenticado revalida no servidor.** `app/(app)/layout.tsx` (que envolve todas as rotas do route group `(app)`) roda em cada navegação e, independentemente do middleware, verifica novamente `supabase.auth.getUser()` — se não houver usuário, redireciona para `/login`. Essa dupla checagem segue a regra de "nunca confiar somente na interface para autorização" (CLAUDE.md §10): o middleware é uma otimização/gate de borda, mas a autorização real é sempre revalidada no servidor.

7. **Carregamento do perfil.** Ainda em `app/(app)/layout.tsx`, com o `user.id` validado, o layout busca a linha correspondente em `public.profiles` (`select('nome, role')... eq('id', user.id).single()`). Esses dados alimentam o `Header` (nome exibido, role exibida) e, futuramente, checagens de autorização por papel.

8. **RLS como última linha de defesa.** A tabela `profiles` tem Row Level Security habilitado (`supabase/migrations/00000000000001_profiles.sql`). Qualquer usuário autenticado pode fazer `SELECT` (policy `profiles_select_authenticated`), mas não existe nenhuma policy de `INSERT`/`UPDATE`/`DELETE` client-side — mesmo que alguém obtivesse o client anon key e tentasse escrever diretamente na tabela, o banco recusaria. Escrita em `profiles` só acontece via Server Action com `service_role` (a ser implementada na Fase 3, junto com CRUD de usuários). Detalhes completos do schema e das políticas estão em [`docs/banco.md`](./banco.md).

9. **Logout.** `signOut()` (`app/login/actions.ts`), invocado pelo botão "Sair" no `Header`, chama `supabase.auth.signOut()` (limpando os cookies de sessão) e redireciona para `/login`.

Resumo em uma linha:

```
username → usernameToAuthEmail() → Supabase Auth (signInWithPassword) → cookie de sessão
   → middleware (getUser em toda request) → layout (app) (getUser + profiles) → RLS (profiles)
```

### Perfis e autorização

A tabela `profiles` guarda `username`, `nome`, `role` (`ADMINISTRADOR` | `TESOUREIRO` | `CONSULTA`) e `ativo`. Na Fase 1, o `role` é apenas exibido no `Header` — não há ainda enforcement de permissões por ação nas telas (essas telas de módulo são placeholders até a Fase 2 em diante). A validação de autorização granular por perfil, conforme CLAUDE.md §10, deve ser implementada em cada módulo de negócio nas fases seguintes, sempre no servidor.

---

## Variáveis de ambiente

Ver `.env.example` na raiz e `docs/instalacao.md` para o passo a passo de configuração:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (reservada para uso futuro em Server Actions administrativas; ainda não consumida por código na Fase 1)

---

## Fora de escopo da Fase 1

Conforme `PROMPT_INICIAL.md` e o self-review do plano da Fase 1: mensalidades, financeiro, campanhas, Grande Loja, recibos e relatórios existem apenas como rotas placeholder na navegação — sem lógica de negócio, sem tabelas de domínio e sem testes. CRUD de usuários e enforcement completo de permissões por perfil ficam para a Fase 3.
