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

> **Nota (Fase 3):** a partir da Fase 3, um Administrador já existente pode criar novos usuários pela tela `/configuracoes/usuarios`. Este passo manual (SQL Editor) só é necessário para o **primeiro** Administrador do sistema, quando ainda não existe nenhum usuário.

A Fase 1 não inclui tela de administração de usuários (isso é escopo da Fase 3). Para conseguir logar pela primeira vez, crie o usuário manualmente:

### 6.1. Criar o usuário em `auth.users`

No painel Supabase, vá em **Authentication → Users → Add user → Create new user**.

- **Email**: use o mesmo padrão que o sistema gera internamente: `<username>@loja.internal` (ex.: para o username `admin`, use `admin@loja.internal`). Isso é necessário porque o Supabase Auth exige e-mail, mas a tela de login do sistema pede apenas usuário e senha — ver `docs/arquitetura.md` para o fluxo completo.
- **Password**: defina uma senha forte temporária.
- Marque **Auto Confirm User** (para não depender de confirmação por e-mail, já que o e-mail é fictício).

> ⚠️ **Cuidado com autocomplete/autocorreção do teclado ou navegador ao digitar o e-mail.** É comum o campo "completar" `loja.internal` para `loja.internal.com` ou `lojainterna.com` sem você perceber. Depois de digitar, confira o valor **letra por letra** antes de salvar, ou valide direto no banco:
> ```sql
> select id, email from auth.users;
> ```
> Se o e-mail salvo não for exatamente `<username>@loja.internal`, o login falha com "usuário ou senha inválido" mesmo com a senha certa (porque o app monta esse e-mail exato para autenticar — `lib/domain/auth.ts`). Se o campo de e-mail do Dashboard não permitir edição direta, corrija via SQL Editor em vez de tentar editar de novo pela tela:
> ```sql
> update auth.users set email = 'admin@loja.internal' where id = 'UUID-DO-USUARIO';
> ```

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

## 6.1. Recuperação de senha por e-mail

O login é por e-mail + senha, e "Esqueci minha senha" envia um link para esse mesmo e-mail. Usuários antigos ainda sem e-mail entram com o username no mesmo campo, até um Administrador cadastrar o e-mail deles em Configurações → Usuários → Editar; enquanto isso, só recuperam a senha por redefinição feita por um Administrador.

Configuração no painel do Supabase (uma vez por projeto):

1. **Authentication → Emails → SMTP Settings:** ativar o SMTP próprio e preencher host, porta, usuário, senha e remetente do provedor.
2. **Authentication → URL Configuration:** *Site URL* = endereço do sistema em produção; em *Redirect URLs*, adicionar `https://SEU-DOMINIO/auth/confirm` (e `http://localhost:3000/auth/confirm` para desenvolvimento).
3. **Authentication → Emails → Templates → Reset Password:** trocar o link do modelo por
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`.
   Sem esse passo o link ainda funciona, mas só se for aberto no mesmo navegador em que foi solicitado.
   O Supabase só permite editar o modelo com SMTP próprio configurado (passo 1) ou em plano pago — no plano gratuito com o envio embutido, o modelo fica o padrão (em inglês) e o limite é de 2 e-mails por hora.

Fluxo: `/recuperar-senha` → e-mail → `/auth/confirm` (troca o token por sessão) → `/nova-senha`.

## 6.2. Lembrete por e-mail de contas a pagar e a receber

O lembrete diário (SPEC §23.1) é enviado por SMTP (ex.: uma conta Gmail) e disparado pelo Vercel Cron (`vercel.json`, todo dia às 11:00 UTC = 08:00 de Brasília, rota `/api/cron/lembretes-contas`).

1. Na conta Google que vai enviar: ativar a **verificação em duas etapas** e criar uma **senha de app** (myaccount.google.com → Segurança → Senhas de app). A senha normal da conta não funciona.
2. Na Vercel, em Settings → Environment Variables (Production), definir:
   - `SMTP_HOST` = `smtp.gmail.com`
   - `SMTP_PORT` = `465`
   - `SMTP_USER` = o endereço Gmail
   - `SMTP_PASS` = a senha de app do passo 1 (16 letras, sem espaços)
   - `EMAIL_REMETENTE` = ex.: `Tesouraria <o-mesmo-endereco@gmail.com>` (no Gmail tem que ser o mesmo endereço do `SMTP_USER`)
   - `CRON_SECRET` = um texto aleatório longo; a Vercel o envia ao chamar a rota, e a rota recusa qualquer chamada sem ele.
3. Fazer um novo deploy para as variáveis valerem.

Sem essas variáveis o resto do sistema funciona normalmente; só o lembrete não é enviado (a rota responde 401 ou 503). O Gmail permite cerca de 500 envios por dia — de sobra para o lembrete.

Os mesmos dados de SMTP podem ser configurados no Supabase (Authentication → Emails → SMTP Settings, seção 6.1), o que libera o modelo do e-mail de recuperação de senha e tira o limite de 2 e-mails por hora.

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

## 9. Validação end-to-end

Login, RLS e o fluxo completo de autenticação (middleware + revalidação no layout + carregamento de perfil) foram validados em 2026-08-10 contra um projeto Supabase real, seguindo exatamente os passos 3-6 acima.
