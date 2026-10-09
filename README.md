# Sistema Maçonaria

Sistema web profissional para gestão administrativa e financeira de uma Loja Maçônica: membros, mensalidades, inadimplência, remidos, Grande Loja, campanhas, doações, financeiro (entradas/saídas/contas/transferências), recibos, relatórios, fechamento mensal, usuários, permissões e auditoria (ver `SPEC.md`).

O projeto está sendo construído por fases incrementais (ver `PROMPT_INICIAL.md`). A Fase 1 (Fundação) entrega o scaffold da aplicação, autenticação (username + senha via Supabase Auth), proteção de rotas e o layout autenticado (sidebar/header) com rotas placeholder para os módulos das fases seguintes.

## Stack

- **Framework**: Next.js 16.3.0 (App Router), React 19
- **Linguagem**: TypeScript (strict mode)
- **Estilos**: Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL, Auth)
- **Testes**: Vitest
- **Deploy**: Vercel

## Começando

### Instalação

```bash
npm install
```

Para o passo a passo completo de setup (criação do projeto Supabase, migrations, criação do primeiro usuário ADMINISTRADOR), ver [`docs/instalacao.md`](./docs/instalacao.md).

### Desenvolvimento

Inicia servidor local em `http://localhost:3000`:

```bash
npm run dev
```

### Build

Compila para produção:

```bash
npm run build
npm start
```

### Lint, tipos e testes

```bash
npm run lint       # ESLint
npx tsc --noEmit   # checagem de tipos
npm test           # Vitest
```

## Configuração

Crie um arquivo `.env.local` baseado em `.env.example` com as credenciais do Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=seu-url-aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-publica-aqui
SUPABASE_SERVICE_ROLE_KEY=sua-chave-privada-aqui
```

Passo a passo completo (projeto Supabase, migrations, primeiro usuário ADMINISTRADOR): [`docs/instalacao.md`](./docs/instalacao.md).

## Autenticação

O login usa **username + senha**. Internamente, o username é mapeado para um e-mail fictício (`<username>@loja.internal`) consumido pelo Supabase Auth — o usuário nunca vê esse e-mail. Sessão é mantida por cookie e validada em toda request pelo middleware, com revalidação server-side no layout autenticado. Detalhes completos do fluxo: [`docs/arquitetura.md`](./docs/arquitetura.md).

## Documentação

- **[SPEC.md](./SPEC.md)** - Especificação completa do sistema
- **[CLAUDE.md](./CLAUDE.md)** - Instruções e regras de desenvolvimento
- **[docs/arquitetura.md](./docs/arquitetura.md)** - Estrutura de pastas e fluxo de autenticação
- **[docs/banco.md](./docs/banco.md)** - Schema do banco, RLS e decisões de design
- **[docs/instalacao.md](./docs/instalacao.md)** - Setup local passo a passo

## Fase de Desenvolvimento

Este projeto está na **Fase 1 — Fundação**, concluída: scaffold, clients Supabase, migration de `profiles` com RLS, autenticação (login/logout), proteção de rotas via middleware e layout autenticado (sidebar/header) com rotas placeholder para os módulos de negócio.

Fora de escopo da Fase 1 (fases seguintes): membros, mensalidades, financeiro, campanhas, Grande Loja, recibos, relatórios, CRUD de usuários e enforcement completo de permissões por perfil.

Roadmap: [PROMPT_INICIAL.md](./PROMPT_INICIAL.md)

## Estrutura do Projeto

```
.
├── app/                  # Next.js App Router (login, layout autenticado, rotas)
├── components/layout/    # Sidebar, Header
├── lib/domain/           # Regras de domínio (ex.: mapeamento username→email)
├── lib/supabase/         # Clients Supabase (browser, server, middleware)
├── supabase/migrations/  # Migrations SQL versionadas
├── public/               # Assets estáticos
├── docs/                 # Documentação (arquitetura, banco, instalação)
├── SPEC.md # Especificação
├── CLAUDE.md             # Regras de dev
└── PROMPT_INICIAL.md     # Plano do projeto
```

## Licença

Privado. Sistema para uso exclusivo da Loja Maçônica.
