# Banco de Dados — Schema e Regras

## Overview

Este documento descreve o schema do banco de dados, políticas de Row Level Security (RLS), constraints e decisões de design aplicadas ao sistema de gestão da Loja Maçônica.

---

## Tabela: `profiles`

**Namespace:** `public.profiles`

**Responsabilidade:** Armazenar perfil de usuário, papel (role) e status de atividade. Vinculado diretamente à tabela `auth.users` do Supabase Auth.

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | — | Primary Key. Referencia `auth.users(id)` com ON DELETE CASCADE. |
| `username` | `text` | Sim | — | Nome de usuário. Armazenado em minúsculas (`check (username ~ '^[a-z0-9._-]+$')`); unicidade garantida por índice único em `lower(username)`, não por `unique` simples na coluna. |
| `nome` | `text` | Sim | — | Nome completo do usuário. |
| `role` | `text` | Sim | — | Papel no sistema. CHECK constraint: `'ADMINISTRADOR'`, `'TESOUREIRO'`, ou `'CONSULTA'`. |
| `ativo` | `boolean` | Sim | `true` | Status de atividade do perfil. |
| `created_at` | `timestamptz` | Sim | `now()` | Timestamp de criação. |
| `updated_at` | `timestamptz` | Sim | `now()` | Timestamp de última atualização. Atualizado automaticamente por trigger. |

### Índices

- `profiles_username_idx`: Índice em LOWER(username) para buscas case-insensitive rápidas.

### Constraints

- **Primary Key:** `id` referencia `auth.users(id)` com ON DELETE CASCADE
- **Unique:** `lower(username)` deve ser único (índice único `profiles_username_idx`)
- **Check:** `role` deve estar em ('ADMINISTRADOR', 'TESOUREIRO', 'CONSULTA')

### Row Level Security (RLS)

**Habilitado:** Sim

**Políticas:**

1. **`profiles_select_authenticated`** (SELECT)
   - **Para:** `authenticated`
   - **Condição:** `true` (qualquer usuário autenticado pode ler qualquer perfil)
   - **Justificativa:** Necessário exibir "quem registrou" em módulos futuros (auditoria, histórico de operações) e no header da aplicação (nome do usuário logado, lista de usuários ativos, etc.).

2. **INSERT/UPDATE/DELETE:** Nenhuma política client-side
   - **Decisão Técnica:** Administração de usuários (criar, editar, desativar) não é executada via INSERT/UPDATE/DELETE direto do cliente. Essas operações passam por **Server Actions** com `service_role`, que ignoram RLS. Essa centralização garante auditoria, validações críticas e que a interface não possa contornar regras de negócio.
   - **Fase 3:** Será implementada a camada de administração de usuários com validações de permissão, auditoria e Server Actions.

### Triggers

**`profiles_set_updated_at`** (BEFORE UPDATE)
- **Função:** `public.set_updated_at()`
- **Efeito:** Atualiza `updated_at` automaticamente para `now()` antes de cada UPDATE, garantindo que o campo sempre reflita a última modificação real.

---

## Decisões de Design

### Senhas e Autenticação

Nenhuma senha é armazenada na tabela `profiles`. A autenticação é delegada inteiramente ao **Supabase Auth** (`auth.users` table), que gerencia credentials de forma segura.

O campo `username` é único e servirá como identificador durante login, mas a validação e armazenamento de senha fica sob responsabilidade do Supabase Auth.

### RLS Somente-Leitura para Authenticated

A política `profiles_select_authenticated` permite que qualquer usuário autenticado leia qualquer perfil. Essa abertura é intencional e segura porque:

1. Não expõe dados sensíveis (senhas são no `auth.users`, não em `profiles`).
2. Permite exibir "quem fez o quê" sem chamadas de backend extras.
3. Reduz complexidade de autorização para operações read-only.
4. A autorização crítica (quem pode criar/editar/deletar usuários) está centralizada em Server Actions com service role.

### Operações de Escrita via Server Actions

- Criar usuário
- Editar perfil
- Desativar/ativar usuário
- Deletar usuário

Essas operações não possuem políticas RLS no client. Em vez disso, são executadas via Server Action Next.js com credencial `service_role`, que contorna RLS e permite implementar lógica crítica de negócio (validações, auditoria, logs).

Essa separação entre read-only (RLS strict) e write (service role centralizado) é padrão em aplicações financeiras.

---

## Migrations e Versionamento

Migrations SQL são versionadas numericamente sob `supabase/migrations/`:

- `00000000000001_profiles.sql` — Criação da tabela profiles com RLS e trigger

**Regra crítica:** Migrations nunca são editadas após aplicação em um banco de dados real. Se houver erro, cria-se uma nova migration para corrigir.

---

## Deploy

- Migrations são aplicadas via `supabase db push` (ambiente local/dev) ou via Supabase Dashboard (produção).
- Migrations não são idempotentes em geral (usam `create table`/`create policy` puros): cada arquivo deve ser executado exatamente uma vez contra um dado banco. `00000000000001_profiles.sql`, em particular, não pode ser colado novamente no SQL Editor após já ter sido aplicado — rodaria em erro por objetos já existentes. Ver a "Opção B" em `docs/instalacao.md`, que é uma alternativa ao `supabase db push` para a primeira aplicação, não um passo repetível.
- Alterações estruturais em produção exigem planejamento de downtime mínimo.

---

## Próximas Fases

- **Fase 2:** Tabelas de domínio (membros, competências, mensalidades, contas, etc.).
- **Fase 3:** Permissões granulares e Server Actions de administração de usuários.
- **Fase 4+:** Dados financeiros e histórico com rastreabilidade.
