# Instalação e Setup Local

Passo a passo para rodar o sistema localmente na Fase 1 (Fundação).

---

## 1. Pré-requisitos

- Node.js 20+ e npm.
- Uma conta em [supabase.com](https://supabase.com) (plano free é suficiente para desenvolvimento).
- Opcional: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) para aplicar migrations via `supabase db push`.

---

## 2. Instalar dependências

Na raiz do projeto:

```bash
npm install
```

---

## 3. Criar o projeto Supabase

1. Acesse [app.supabase.com](https://app.supabase.com) e crie um novo projeto (escolha região e senha do banco).
2. Aguarde o provisionamento (leva alguns minutos).
3. No painel do projeto, vá em **Project Settings → API** e anote:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (mantenha esta chave em segredo — nunca commitar, nunca expor no frontend)

---

## 4. Configurar variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env.local
```

Edite `.env.local` e preencha com os valores obtidos no passo anterior:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

`.env.local` já está no `.gitignore` do projeto Next.js padrão — nunca commitar esse arquivo.

---

## 5. Aplicar as migrations

As migrations SQL do projeto ficam em `supabase/migrations/`. Existem duas formas de aplicá-las:

### Opção A — Supabase CLI (recomendado)

```bash
supabase login
supabase link --project-ref <seu-project-ref>
supabase db push
```

O `<seu-project-ref>` é encontrado na URL do painel do projeto ou em **Project Settings → General**.

### Opção B — SQL Editor do Supabase Dashboard

1. Abra o projeto no painel Supabase → **SQL Editor**.
2. Cole o conteúdo de `supabase/migrations/00000000000001_profiles.sql` e execute.

Isso cria a tabela `public.profiles` (com RLS habilitado) e o trigger de `updated_at`. Detalhes do schema em [`docs/banco.md`](./banco.md).

---

## 6. Criar o primeiro usuário ADMINISTRADOR

A Fase 1 não inclui tela de administração de usuários (isso é escopo da Fase 3). Para conseguir logar pela primeira vez, crie o usuário manualmente:

### 6.1. Criar o usuário em `auth.users`

No painel Supabase, vá em **Authentication → Users → Add user → Create new user**.

- **Email**: use o mesmo padrão que o sistema gera internamente: `<username>@loja.internal` (ex.: para o username `admin`, use `admin@loja.internal`). Isso é necessário porque o Supabase Auth exige e-mail, mas a tela de login do sistema pede apenas usuário e senha — ver `docs/arquitetura.md` para o fluxo completo.
- **Password**: defina uma senha forte temporária.
- Marque **Auto Confirm User** (para não depender de confirmação por e-mail, já que o e-mail é fictício).

Alternativa via SQL Editor (caso prefira não usar a UI), usando a função administrativa do Supabase:

```sql
select auth.uid() from auth.users; -- apenas para conferir que a extensão auth está disponível
```

> Criar usuários diretamente via `insert into auth.users` não é recomendado nem suportado pelo Supabase (a tabela tem triggers e requisitos internos de hashing de senha). Use sempre a tela **Authentication → Users** do Dashboard ou a Admin API (`supabase.auth.admin.createUser`) para criar o registro em `auth.users`.

Depois de criar o usuário, copie o **UUID** gerado (coluna `id` na listagem de usuários).

### 6.2. Criar o perfil correspondente em `public.profiles`

No **SQL Editor**, rode (substituindo o UUID e os dados reais):

```sql
insert into public.profiles (id, username, nome, role, ativo)
values (
  '00000000-0000-0000-0000-000000000000', -- UUID copiado do auth.users
  'admin',                                  -- username (mesmo usado no e-mail interno)
  'Nome Completo do Administrador',
  'ADMINISTRADOR',
  true
);
```

### 6.3. Testar o login

1. Rode o servidor local (passo 7).
2. Acesse `http://localhost:3000/login`.
3. Entre com o **username** (`admin`, sem o domínio `@loja.internal`) e a senha definida no passo 6.1.
4. Deve redirecionar para `/dashboard`, exibindo o nome e o role no cabeçalho.

---

## 7. Rodar o projeto localmente

```bash
npm run dev
```

Acesse `http://localhost:3000`.

---

## 8. Comandos úteis

```bash
npm run lint       # ESLint
npx tsc --noEmit   # checagem de tipos
npm test           # Vitest (testes unitários)
npm run build      # build de produção
```

---

## 9. Pendência conhecida

Login e as políticas de RLS só podem ser validados ponta-a-ponta contra um projeto Supabase real (não há mock/stub de Supabase na Fase 1). Assim que as credenciais de um projeto Supabase forem fornecidas, deve-se: aplicar as migrations (passo 5) e criar o primeiro usuário ADMINISTRADOR (passo 6) para validar o fluxo completo de autenticação em ambiente real.
