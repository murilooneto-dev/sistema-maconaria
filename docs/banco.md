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

## Funções auxiliares de RLS (`00000000000002_auth_helpers.sql`)

Antes das tabelas de domínio, a Fase 2 cria três funções `security definer` usadas por praticamente todas as policies de escrita das tabelas abaixo:

- **`public.current_profile_role()`** — retorna o `role` do `profiles` cujo `id = auth.uid()`, mas **somente se `ativo = true`**. Um usuário desativado passa a ser tratado como "sem role" por qualquer policy que dependa desta função, mesmo com sessão válida — reforça a regra de que `ativo = false` bloqueia operações de escrita no banco, não só na UI.
- **`public.is_admin()`** — `true` quando `current_profile_role() = 'ADMINISTRADOR'`.
- **`public.is_tesoureiro()`** — `true` quando `current_profile_role()` é `'ADMINISTRADOR'` ou `'TESOUREIRO'` (Administrador herda as permissões de Tesoureiro).

As três são `stable`, `security definer` e `set search_path = ''`, seguindo o mesmo padrão de `public.set_updated_at()` (Fase 1): evita que RLS na própria tabela `profiles` impeça a função de ler o role do usuário logado, e o `search_path` vazio evita sequestro de função por schema.

**Por quê:** CLAUDE.md §10/§11 exige que a autorização por perfil seja validada no servidor/banco, nunca só na interface. Centralizar a lógica de role em três funções SQL reutilizadas por todas as policies evita duplicar (e divergir) a regra de permissão em cada tabela.

---

## Tabela: `loja_config`

**Namespace:** `public.loja_config` · **Migration:** `00000000000003_loja_config_mensalidade.sql`

**Responsabilidade:** Configuração única da Loja (nome, logo), usada no layout/branding do sistema.

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `smallint` | Sim | `1` | PK fixa; `check (id = 1)` garante linha única (padrão "singleton row"). |
| `nome` | `text` | Sim | — | Nome da Loja. |
| `logo_url` | `text` | Não | — | URL do logo (Supabase Storage). |
| `assinatura_url` | `text` | Não | — | Caminho (path) do objeto no bucket privado `loja-assinaturas` do Supabase Storage — não é mais uma URL pública desde `00000000000018_assinaturas_privadas.sql`. Coluna adicionada por `00000000000016_loja_assets.sql` (Fase 4). |
| `created_at` / `updated_at` | `timestamptz` | Sim | `now()` | Auditoria temporal padrão. |

### Constraints

- **Check:** `id = 1` — impede a criação de uma segunda linha de configuração.

### RLS

- `loja_config_select_authenticated` (SELECT, `authenticated`, `true`): qualquer usuário logado lê a config (nome/logo aparecem no header/layout para todos os perfis).
- `loja_config_write_admin_insert` / `loja_config_write_admin_update` (INSERT/UPDATE, `authenticated`, `using/with check public.is_admin()`): só Administrador escreve. Desde `00000000000015_fase2_correcoes.sql`, sem policy de DELETE.

**Por quê:** SPEC §28 (Configurações) reserva a edição de dados institucionais da Loja ao Administrador; leitura precisa ser ampla porque o nome/logo aparece na UI para todos.

### Triggers

`loja_config_set_updated_at` (BEFORE UPDATE) → `public.set_updated_at()`.

### Storage: bucket `loja-assets` (Fase 4, `00000000000016_loja_assets.sql`)

O logo (`logo_url`) de `loja_config` é um arquivo armazenado no bucket público `loja-assets` do Supabase Storage, não em `bytea`/base64 no Postgres.

- **`public: true`** — o bucket é de leitura pública (necessário para exibir o logo na UI e nos recibos em PDF sem exigir sessão autenticada), mas a escrita é restrita:
  - `loja_assets_select_public` (SELECT em `storage.objects`, sem restrição de role) — qualquer requisição, autenticada ou não, lê qualquer objeto do bucket.
  - `loja_assets_insert_admin` / `loja_assets_update_admin` (INSERT/UPDATE em `storage.objects`, `authenticated`, `public.is_admin()`) — só Administrador grava/substitui arquivos. Sem policy de DELETE.
  - `00000000000017_loja_config_seed.sql` (Fase 4, revisão) adiciona `file_size_limit`/`allowed_mime_types` (5MB, apenas imagens) ao bucket, que originalmente não tinha nenhum limite server-side.
- **Upload nunca acontece diretamente do client.** A Server Action `atualizarLoja` (`app/(app)/configuracoes/loja/actions.ts`) chama `requireAdmin()` e então usa `createSupabaseServiceRoleClient()` (`service_role`, que ignora RLS) para fazer `storage.from('loja-assets').upload(...)` e obter a `publicUrl`. As policies `loja_assets_insert_admin`/`loja_assets_update_admin` acima protegem contra upload via client autenticado normal (chave `anon`); a Server Action é a camada 2 de enforcement (mesmo padrão de `requireAdmin()` + `service_role` já usado em `configuracoes/usuarios`, ver `docs/permissoes.md`).
- Os arquivos são gravados sob o prefixo `logo/`, com nome `${Date.now()}-${nomeSanitizado}` (sem acentos, apenas `[a-zA-Z0-9.-]`) para evitar colisão e caracteres inválidos na URL pública.

### Storage: bucket `loja-assinaturas` (Fase 4, revisão, `00000000000018_assinaturas_privadas.sql`)

A assinatura de recibo (`assinatura_url` em `loja_config`, que a partir desta revisão guarda o **caminho do objeto no Storage**, não mais uma URL pública) é armazenada em um bucket **privado** separado (`loja-assinaturas`, `public: false`), diferente de `loja-assets`. Motivo: a assinatura autentica documentos financeiros (recibos) e não deve ser legível por qualquer visitante não autenticado — diferente do logo, que é genuinamente público.

- `loja_assinaturas_select_authenticated` (SELECT em `storage.objects`, `authenticated`, sem restrição de admin) — qualquer usuário logado pode gerar uma signed URL para a assinatura (necessário para a prévia em `configuracoes/recibo` e, futuramente, para a geração de PDF na Fase 10).
- `loja_assinaturas_insert_admin` / `loja_assinaturas_update_admin` (INSERT/UPDATE, `authenticated`, `public.is_admin()`) — só Administrador grava/substitui.
- `file_size_limit`/`allowed_mime_types` (5MB, apenas imagens) aplicados desde a criação do bucket.
- A Server Action `atualizarAssinatura` (`app/(app)/configuracoes/recibo/actions.ts`) faz upload via `service_role` e grava apenas o **path** (`assinaturas/${Date.now()}-${nomeSanitizado}`) em `loja_config.assinatura_url`. Como o bucket é privado, `getPublicUrl` não funciona mais; `app/(app)/configuracoes/recibo/page.tsx` gera uma signed URL (`createSignedUrl`, validade de 5 minutos) sob demanda, só para exibir a prévia na tela — usando o client normal (não `service_role`), pois a policy de SELECT já libera para qualquer `authenticated`.

---

## Tabela: `config_mensalidade`

**Namespace:** `public.config_mensalidade` · **Migration:** `00000000000003_loja_config_mensalidade.sql`

**Responsabilidade:** Histórico de valores de mensalidade vigentes por `tipo` (`NORMAL`/`REMIDO`), com o rateio Loja/Grande Loja já definido no momento do cadastro.

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `tipo` | `text` | Sim | — | `'NORMAL'` ou `'REMIDO'` (check). |
| `valor_mensalidade` | `numeric(12,2)` | Sim | — | Valor total da mensalidade (`>= 0`). |
| `valor_grande_loja` | `numeric(12,2)` | Sim | — | Parcela da Grande Loja (`>= 0` e `<= valor_mensalidade`). |
| `valor_loja` | `numeric(12,2)` | Sim (gerada) | `valor_mensalidade - valor_grande_loja` | Coluna `generated always as ... stored` — nunca digitada, sempre coerente com as outras duas. |
| `vigente_desde` | `timestamptz` | Sim | `now()` | Início da vigência deste valor. |
| `criado_por` | `uuid` | Não | — | FK → `profiles(id)`. |
| `created_at` | `timestamptz` | Sim | `now()` | — |

### Índices

- `config_mensalidade_tipo_vigente_idx` em `(tipo, vigente_desde desc)` — consulta eficiente do valor vigente mais recente por tipo.

### RLS

- `config_mensalidade_select_authenticated` (SELECT, `authenticated`, `true`).
- `config_mensalidade_insert_admin` (INSERT, `authenticated`, `with check public.is_admin()`). **Sem policy de UPDATE/DELETE** — a tabela é somente-inserção: alterar o valor de mensalidade sempre cria uma nova linha vigente, nunca sobrescreve uma anterior.

**Por quê:** CLAUDE.md §5/§6 e SPEC §9: "alterar configuração futura nunca altera valores históricos". Por isso a tabela é insert-only e cada `mensalidades` grava seu próprio `valor_grande_loja`/`valor_loja` no momento em que é gerada (ver tabela `mensalidades` abaixo), em vez de referenciar `config_mensalidade` por FK — a competência preserva o valor histórico mesmo que uma configuração futura mude.

---

## Tabela: `membros`

**Namespace:** `public.membros` · **Migration:** `00000000000004_membros.sql`

**Responsabilidade:** Cadastro de membros da Loja.

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `nome` | `text` | Sim | — | — |
| `telefone` | `text` | Não | — | — |
| `matricula` | `text` | Sim | — | `unique`. |
| `do_quadro` | `boolean` | Sim | `true` | Pertence ao quadro atual da Loja. |
| `remido` | `boolean` | Sim | `false` | Membro remido (isento de mensalidade normal — ver SPEC §9). |
| `recolhe` | `boolean` | Sim | `false` | Indica se recolhe (flag operacional de quadro, conforme SPEC §6). |
| `situacao` | `text` | Sim | `'ATIVO'` | `'ATIVO'` ou `'INATIVO'` (check). |
| `data_cadastro` | `date` | Sim | `current_date` | — |
| `created_at` / `updated_at` | `timestamptz` | Sim | `now()` | — |

### Índices

- `membros_situacao_idx` em `situacao`, `membros_do_quadro_idx` em `do_quadro` — filtros usados em listagens/relatórios (SPEC §6, §29).

### Constraints

- **Unique:** `matricula`.
- **Check:** `situacao in ('ATIVO', 'INATIVO')`.

### RLS

- `membros_select_authenticated` (SELECT, `authenticated`, `true`).
- `membros_write_admin_insert` / `membros_write_admin_update` (INSERT/UPDATE, `authenticated`, `public.is_admin()`) — desde `00000000000015_fase2_correcoes.sql`, sem policy de DELETE.

**Por quê:** SPEC §6 trata cadastro de membro como dado cadastral/institucional, não uma operação financeira do dia a dia — por isso a escrita fica restrita ao Administrador (diferente de mensalidades/pagamentos, que Tesoureiro também escreve). A transição `INATIVO → ATIVO` automática por regularização de inadimplência (CLAUDE.md §9, SPEC §7) é lógica de domínio da Fase 6, não uma policy ou trigger SQL — Fase 2 só garante a coluna `situacao` e seu `check`.

### Triggers

`membros_set_updated_at` (BEFORE UPDATE) → `public.set_updated_at()`.

---

## Tabela: `contas`

**Namespace:** `public.contas` · **Migration:** `00000000000005_contas_formas_pagamento.sql`

**Responsabilidade:** Contas financeiras da Loja (bancárias, caixa, etc.) que recebem/pagam movimentações.

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `nome` | `text` | Sim | — | `unique`. |
| `descricao` | `text` | Não | — | — |
| `saldo_inicial` | `numeric(12,2)` | Sim | `0` | Saldo na data de abertura da conta no sistema (SPEC §21). |
| `data_saldo_inicial` | `date` | Sim | — | Data de referência do `saldo_inicial`. |
| `ativo` | `boolean` | Sim | `true` | — |
| `created_at` / `updated_at` | `timestamptz` | Sim | `now()` | — |

### Constraints

- **Unique:** `nome`.

### RLS

- `contas_select_authenticated` (SELECT, `authenticated`, `true`).
- `contas_write_admin_insert` / `contas_write_admin_update` (INSERT/UPDATE, `authenticated`, `public.is_admin()`) — desde `00000000000015_fase2_correcoes.sql`, sem policy de DELETE.

**Por quê:** SPEC §18 trata cadastro de contas como configuração financeira estrutural (cria/edita fonte de saldo), reservada ao Administrador; Tesoureiro movimenta saldo (mensalidades, pagamentos, transferências) mas não cria/edita contas.

### Triggers

`contas_set_updated_at` (BEFORE UPDATE) → `public.set_updated_at()`.

---

## Tabela: `formas_pagamento`

**Namespace:** `public.formas_pagamento` · **Migration:** `00000000000005_contas_formas_pagamento.sql`

**Responsabilidade:** Formas de pagamento aceitas (Dinheiro, PIX, etc.), referenciadas por pagamentos/doações/movimentações.

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `nome` | `text` | Sim | — | `unique`. |
| `ativo` | `boolean` | Sim | `true` | — |
| `created_at` / `updated_at` | `timestamptz` | Sim | `now()` | — |

### RLS

- `formas_pagamento_select_authenticated` (SELECT, `authenticated`, `true`).
- `formas_pagamento_write_admin_insert` / `formas_pagamento_write_admin_update` (INSERT/UPDATE, `authenticated`, `public.is_admin()`) — desde `00000000000015_fase2_correcoes.sql`, sem policy de DELETE.

**Por quê:** SPEC §19 — lista estruturada de formas de pagamento é configuração, não operação financeira do dia a dia; escrita restrita ao Administrador, leitura ampla (todo lançamento financeiro referencia essa tabela).

### Triggers

`formas_pagamento_set_updated_at` (BEFORE UPDATE) → `public.set_updated_at()`.

---

## Tabela: `campanhas`

**Namespace:** `public.campanhas` · **Migration:** `00000000000006_campanhas.sql`

**Responsabilidade:** Campanhas de arrecadação/assistência (SPEC §24), que recebem doações.

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `titulo` | `text` | Sim | — | — |
| `objetivo` | `text` | Não | — | — |
| `meta` | `numeric(12,2)` | Sim | — | `>= 0`. |
| `pessoa_ajudada` | `text` | Não | — | — |
| `contato` | `text` | Não | — | — |
| `endereco` | `text` | Não | — | — |
| `descricao` | `text` | Não | — | — |
| `data_inicial` | `date` | Sim | — | — |
| `data_final` | `date` | Não | — | — |
| `status` | `text` | Sim | `'EM_ANDAMENTO'` | `'EM_ANDAMENTO'`, `'CONCLUIDA'`, `'CANCELADA'` (check). |
| `created_at` / `updated_at` | `timestamptz` | Sim | `now()` | — |

### Índices

- `campanhas_status_idx` em `status`.

### Constraints

- **Check `campanhas_datas_check`:** `data_final is null or data_final >= data_inicial`.

### RLS

- `campanhas_select_authenticated` (SELECT, `authenticated`, `true`).
- `campanhas_write_tesoureiro_insert` / `campanhas_write_tesoureiro_update` (INSERT/UPDATE, `authenticated`, `public.is_tesoureiro()`) — desde `00000000000015_fase2_correcoes.sql`, sem policy de DELETE.

**Por quê:** SPEC §24 trata campanhas como operação financeira/assistencial corrente, no mesmo grupo de mensalidades/pagamentos — Tesoureiro (que inclui Administrador via `is_tesoureiro()`) gerencia.

**Fase 8:** `status` transiciona `EM_ANDAMENTO → CONCLUIDA` automaticamente quando a soma das doações ativas atinge `meta` (`recalcularStatusCampanha()` em `lib/campanhas/recalcular-status.ts`, chamada após cada doação registrada/cancelada). Nunca reabre sozinho — reabertura é sempre uma ação manual (`reabrirCampanha`). `CANCELADA` também é manual (`cancelarCampanha`), independente de meta.

### Triggers

`campanhas_set_updated_at` (BEFORE UPDATE) → `public.set_updated_at()`.

---

## Tabela: `mensalidades`

**Namespace:** `public.mensalidades` · **Migration:** `00000000000007_mensalidades.sql`

**Responsabilidade:** Uma linha por competência (ano/mês) devida por um membro — a "competência" independente da data de pagamento (CLAUDE.md §5).

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `membro_id` | `uuid` | Sim | — | FK → `membros(id)`. |
| `ano` | `integer` | Sim | — | `2000..2100` (check). |
| `mes` | `integer` | Sim | — | `1..12` (check). |
| `valor_devido` | `numeric(12,2)` | Sim | — | `>= 0`. |
| `valor_grande_loja` | `numeric(12,2)` | Sim | — | Parcela Grande Loja **desta competência**, gravada no momento da criação — histórico, não recalculada a partir de `config_mensalidade` depois. |
| `valor_loja` | `numeric(12,2)` | Sim | — | Parcela Loja desta competência. |
| `valor_pago` | `numeric(12,2)` | Sim | `0` | Acumulado pago (soma de `pagamento_mensalidades.valor_aplicado` para esta competência — ver decisão técnica abaixo). |
| `saldo` | `numeric(12,2)` | Sim (gerada) | `valor_devido - valor_pago` | Coluna gerada. |
| `status` | `text` | Sim | `'PENDENTE'` | `'PENDENTE'`, `'PARCIAL'`, `'QUITADA'`, `'CANCELADA'`, `'NAO_APLICAVEL'` (check). |
| `data_quitacao` | `timestamptz` | Não | — | Preenchida quando `status = 'QUITADA'` (regra de domínio, Fase 6 — não há check SQL forçando a correlação). |
| `created_at` / `updated_at` | `timestamptz` | Sim | `now()` | — |

### Índices

- `mensalidades_membro_idx` em `membro_id`, `mensalidades_ano_mes_idx` em `(ano, mes)`, `mensalidades_status_idx` em `status`.
- `mensalidades_membro_ano_mes_key`: índice único **parcial** em `(membro_id, ano, mes) where status <> 'CANCELADA'` — garante uma única competência ativa por membro/ano/mês (CLAUDE.md §7), mas permite recriar a competência caso a original tenha sido cancelada.

### Constraints

- **Check `mensalidades_rateio_check`:** `valor_devido = valor_grande_loja + valor_loja` — rateio sempre bate (CLAUDE.md §5).
- **Check `mensalidades_valor_pago_limite`:** `valor_pago <= valor_devido` — impede saldo negativo por pagamento excedente registrado direto na competência (pagamento acima do valor deve ser distribuído entre competências pelo operador, SPEC §13/CLAUDE.md §5, não "estourar" uma única competência).
- **Checks `valor_grande_loja >= 0` e `valor_loja >= 0`** — impedem parcelas negativas no rateio da competência.

### RLS

- `mensalidades_select_authenticated` (SELECT, `authenticated`, `true`).
- `mensalidades_write_tesoureiro_insert` / `mensalidades_write_tesoureiro_update` (INSERT/UPDATE, `authenticated`, `public.is_tesoureiro()`) — desde `00000000000015_fase2_correcoes.sql`, que fechou a policy `for all` original para não conceder DELETE implícito; não existe policy de DELETE, então a exclusão física é negada por padrão pelo RLS.

**Por quê:** SPEC §8/§14/§15 — geração e baixa de competências é operação financeira corrente, feita por Tesoureiro/Administrador.

### Triggers

`mensalidades_set_updated_at` (BEFORE UPDATE) → `public.set_updated_at()`.

---

## Tabela: `pagamentos`

**Namespace:** `public.pagamentos` · **Migration:** `00000000000008_pagamentos.sql`

**Responsabilidade:** Um pagamento realizado por um membro, que pode quitar uma ou várias competências (via `pagamento_mensalidades`).

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `membro_id` | `uuid` | Sim | — | FK → `membros(id)`. |
| `valor_total` | `numeric(12,2)` | Sim | — | `> 0`. |
| `data_pagamento` | `date` | Sim | — | Data em que o pagamento ocorreu — **diferente** da(s) competência(s) quitada(s) (CLAUDE.md §5). |
| `conta_id` | `uuid` | Sim | — | FK → `contas(id)` — qual conta recebeu. |
| `forma_pagamento_id` | `uuid` | Sim | — | FK → `formas_pagamento(id)`. |
| `usuario_id` | `uuid` | Sim | — | FK → `profiles(id)` — quem registrou. |
| `observacao` | `text` | Não | — | — |
| `status` | `text` | Sim | `'ATIVO'` | `'ATIVO'` ou `'CANCELADO'` (check). |
| `motivo_cancelamento` | `text` | Não | — | Obrigatório se `CANCELADO` (ver constraint). |
| `cancelado_por` | `uuid` | Não | — | FK → `profiles(id)`. |
| `cancelado_em` | `timestamptz` | Não | — | — |
| `created_at` / `updated_at` | `timestamptz` | Sim | `now()` | — |

### Índices

- `pagamentos_membro_idx`, `pagamentos_conta_idx`, `pagamentos_data_idx`, `pagamentos_status_idx`.

### Constraints

- **Check `pagamentos_cancelamento_check`:** ou `status = 'ATIVO'` e os três campos de cancelamento são `null`, ou `status = 'CANCELADO'` e os três são `not null` — nunca um cancelamento "pela metade" (CLAUDE.md §8/§12: usuário, data e motivo do cancelamento sempre rastreáveis).

### RLS

- `pagamentos_select_authenticated` (SELECT, `authenticated`, `true`).
- `pagamentos_write_tesoureiro_insert` / `pagamentos_write_tesoureiro_update` (INSERT/UPDATE, `authenticated`, `public.is_tesoureiro()`) — desde `00000000000015_fase2_correcoes.sql`.

**Por quê:** SPEC §11/§12/§13 e CLAUDE.md §4 — todo o rastro "quem pagou, quanto, quando, qual conta, qual forma" fica nesta tabela; cancelamento nunca é DELETE físico (CLAUDE.md §8), é update de `status` — e desde `00000000000015_fase2_correcoes.sql` isso não é mais só uma convenção de aplicação: o RLS efetivamente nega qualquer tentativa de DELETE, pois não existe policy de delete para esta tabela.

### Triggers

`pagamentos_set_updated_at` (BEFORE UPDATE) → `public.set_updated_at()`.

---

## Tabela: `pagamento_mensalidades`

**Namespace:** `public.pagamento_mensalidades` · **Migration:** `00000000000008_pagamentos.sql`

**Responsabilidade:** Tabela de junção N:N entre `pagamentos` e `mensalidades` — cada linha é "este pagamento aplicou X reais nesta competência".

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `pagamento_id` | `uuid` | Sim | — | FK → `pagamentos(id)`, `on delete restrict` (apertado de `on delete cascade` por `00000000000015_fase2_correcoes.sql` — excluir um pagamento nunca deve apagar silenciosamente seus vínculos com competências). |
| `mensalidade_id` | `uuid` | Sim | — | FK → `mensalidades(id)`. |
| `valor_aplicado` | `numeric(12,2)` | Sim | — | `> 0` — quanto deste pagamento foi aplicado nesta competência. |
| `created_at` | `timestamptz` | Sim | `now()` | — |

### Índices e constraints

- `pagamento_mensalidades_pagamento_idx`, `pagamento_mensalidades_mensalidade_idx`.
- **Unique `pagamento_mensalidades_unica`:** `(pagamento_id, mensalidade_id)` — um mesmo pagamento não pode aplicar valor duas vezes na mesma competência (mas pode aplicar em várias competências diferentes — pagamento atrasado quitando abril/maio/junho, SPEC §8).

### RLS

- `pagamento_mensalidades_select_authenticated` (SELECT, `authenticated`, `true`).
- `pagamento_mensalidades_write_tesoureiro_insert` / `pagamento_mensalidades_write_tesoureiro_update` (INSERT/UPDATE, `authenticated`, `public.is_tesoureiro()`) — desde `00000000000015_fase2_correcoes.sql`.

**Por quê:** Materializa o rateio "um pagamento pode quitar várias competências" e "pagamento parcial" do CLAUDE.md §5/SPEC §12/§13 de forma explícita e consultável, em vez de um campo solto em `mensalidades`.

### Decisão técnica: consistência agregada não é imposta por trigger SQL

A soma de `pagamento_mensalidades.valor_aplicado` para uma dada `mensalidade_id` deve, na prática, corresponder a `mensalidades.valor_pago` daquela competência. A Fase 2 **não** cria trigger/constraint SQL para impor essa soma automaticamente: a atualização de `mensalidades.valor_pago` e a criação das linhas de `pagamento_mensalidades` correspondentes serão feitas de forma atômica pela camada de aplicação/domínio na Fase 6 (transação de "registrar pagamento"), com testes unitários (Vitest) cobrindo os cenários de borda (pagamento parcial, pagamento quitando múltiplas competências, pagamento acima do valor). Fase 2 entrega apenas a estrutura (tabelas, FKs, constraints básicas) — a regra de consistência é responsabilidade do serviço de domínio, não do banco, para manter a lógica de negócio auditável e testável em TypeScript em vez de PL/pgSQL.

---

## Tabela: `doacoes`

**Namespace:** `public.doacoes` · **Migration:** `00000000000009_doacoes.sql`

**Responsabilidade:** Doações recebidas para uma campanha, de um doador (membro ou não).

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `campanha_id` | `uuid` | Sim | — | FK → `campanhas(id)`. |
| `doador` | `text` | Sim | — | Nome do doador (texto livre — doador pode não ser membro). |
| `membro_id` | `uuid` | Não | — | FK → `membros(id)`, opcional (doador pode ser membro ou não). |
| `valor` | `numeric(12,2)` | Sim | — | `> 0`. |
| `data` | `date` | Sim | — | — |
| `conta_id` | `uuid` | Sim | — | FK → `contas(id)`. |
| `forma_pagamento_id` | `uuid` | Sim | — | FK → `formas_pagamento(id)`. |
| `observacao` | `text` | Não | — | — |
| `usuario_id` | `uuid` | Sim | — | FK → `profiles(id)` — quem registrou. |
| `status` | `text` | Sim | `'ATIVO'` | `'ATIVO'` ou `'CANCELADO'` (check). |
| `motivo_cancelamento` / `cancelado_por` / `cancelado_em` | — | Não | — | Igual ao padrão de `pagamentos`. |
| `created_at` / `updated_at` | `timestamptz` | Sim | `now()` | — |

### Índices

- `doacoes_campanha_idx`, `doacoes_membro_idx`, `doacoes_status_idx`.

### Constraints

- **Check `doacoes_cancelamento_check`:** mesmo padrão par-ou-nada de `pagamentos_cancelamento_check`.

### RLS

- `doacoes_select_authenticated` (SELECT, `authenticated`, `true`).
- `doacoes_write_tesoureiro_insert` / `doacoes_write_tesoureiro_update` (INSERT/UPDATE, `authenticated`, `public.is_tesoureiro()`) — desde `00000000000015_fase2_correcoes.sql`, sem policy de DELETE.

**Por quê:** SPEC §25 — doação é operação financeira corrente ligada a campanhas, mesma trilha de rastreabilidade e cancelamento não-destrutivo de `pagamentos`.

**Fase 8:** cada doação registrada cria automaticamente uma `movimentacoes` (ENTRADA, categoria de sistema "Campanha", `doacao_id` + `campanha_id` preenchidos) — mesmo padrão do vínculo pagamento↔movimentação da Fase 7 (`lib/financeiro/movimentacao-doacao.ts`). Cancelar a doação cancela a movimentação vinculada; se a movimentação falhar ao ser criada, a doação é cancelada automaticamente (compensação, sem deixar doação órfã sem rastro financeiro).

### Triggers

`doacoes_set_updated_at` (BEFORE UPDATE) → `public.set_updated_at()`.

---

## Tabela: `movimentacoes`

**Namespace:** `public.movimentacoes` · **Migration:** `00000000000010_movimentacoes_transferencias.sql`

**Responsabilidade:** Livro-caixa: toda entrada/saída financeira ativa em uma conta, incluindo as geradas por `pagamentos`/`doacoes` e as lançadas manualmente.

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `data` | `date` | Sim | — | — |
| `tipo` | `text` | Sim | — | `'ENTRADA'` ou `'SAIDA'` (check). |
| `categoria_id` | `uuid` | Sim | — | FK → `categorias_movimentacao(id)` — desde `00000000000020_financeiro_fase7.sql` (era `categoria text` livre até então; a tabela nunca tinha sido populada, então a normalização para FK foi segura mesmo em produção). |
| `descricao` | `text` | Não | — | — |
| `valor` | `numeric(12,2)` | Sim | — | `> 0`. |
| `conta_id` | `uuid` | Sim | — | FK → `contas(id)`. |
| `forma_pagamento_id` | `uuid` | Sim | — | FK → `formas_pagamento(id)`. |
| `membro_id` | `uuid` | Não | — | FK → `membros(id)`, opcional. |
| `campanha_id` | `uuid` | Não | — | FK → `campanhas(id)`, opcional. |
| `usuario_id` | `uuid` | Sim | — | FK → `profiles(id)`. |
| `origem` | `text` | Sim | — | Texto livre identificando a origem do lançamento — não é enum fechado no banco. Valores usados pela aplicação: `'MANUAL'` (lançamento manual em `/financeiro/nova`, Fase 7), `'MENSALIDADE'` (gerado automaticamente ao registrar um pagamento de mensalidade; cancelamento só via tela de Mensalidades, Fase 7) e `'CAMPANHA'` (gerado automaticamente ao registrar uma doação; cancelamento só via tela da campanha, Fase 8). |
| `pagamento_id` | `uuid` | Não | — | FK → `pagamentos(id)`, preenchida quando a movimentação foi gerada por um pagamento de mensalidade. |
| `doacao_id` | `uuid` | Não | — | FK → `doacoes(id)`, preenchida quando gerada por uma doação. |
| `status` | `text` | Sim | `'ATIVO'` | `'ATIVO'` ou `'CANCELADO'` (check). |
| `motivo_cancelamento` / `cancelado_por` / `cancelado_em` | — | Não | — | Padrão par-ou-nada. |
| `observacao` | `text` | Não | — | — |
| `created_at` / `updated_at` | `timestamptz` | Sim | `now()` | — |

### Índices

- `movimentacoes_data_idx`, `movimentacoes_tipo_idx`, `movimentacoes_conta_idx`, `movimentacoes_campanha_idx`, `movimentacoes_status_idx`, `movimentacoes_categoria_idx` (desde `00000000000020_financeiro_fase7.sql`).

### Constraints

- **Check `movimentacoes_cancelamento_check`:** mesmo padrão par-ou-nada.

### RLS

- `movimentacoes_select_authenticated` (SELECT, `authenticated`, `true`).
- `movimentacoes_write_tesoureiro_insert` / `movimentacoes_write_tesoureiro_update` (INSERT/UPDATE, `authenticated`, `public.is_tesoureiro()`) — desde `00000000000015_fase2_correcoes.sql`, sem policy de DELETE.

**Por quê:** SPEC §17 — é o extrato consolidado usado para saldo de conta e relatórios (SPEC §29); `pagamento_id`/`doacao_id` opcionais preservam a rastreabilidade "qual operação originou esta movimentação" sem forçar toda movimentação a ter uma origem de mensalidade/doação (lançamentos manuais de despesa também passam por aqui).

### Triggers

- `movimentacoes_set_updated_at` (BEFORE UPDATE) → `public.set_updated_at()`.
- `movimentacoes_bloqueia_cancelamento_fechado` (BEFORE UPDATE, desde `00000000000020_financeiro_fase7.sql`) → `public.bloqueia_cancelamento_periodo_fechado()`: rejeita a transição para `status = 'CANCELADO'` se o mês de `data` já tiver um `fechamentos_mensais` com `status = 'FECHADO'`. Criação de lançamento novo com data retroativa dentro de um mês fechado continua permitida — só o cancelamento é bloqueado (decisão do usuário, 2026-08-12).

---

## Tabela: `transferencias`

**Namespace:** `public.transferencias` · **Migration:** `00000000000010_movimentacoes_transferencias.sql`

**Responsabilidade:** Transferência de saldo entre duas contas da Loja — não é receita nem despesa (CLAUDE.md §8), por isso é uma tabela separada de `movimentacoes`.

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `conta_origem_id` | `uuid` | Sim | — | FK → `contas(id)`. |
| `conta_destino_id` | `uuid` | Sim | — | FK → `contas(id)`. |
| `valor` | `numeric(12,2)` | Sim | — | `> 0`. |
| `data` | `date` | Sim | — | — |
| `observacao` | `text` | Não | — | — |
| `usuario_id` | `uuid` | Sim | — | FK → `profiles(id)`. |
| `status` | `text` | Sim | `'ATIVO'` | `'ATIVO'` ou `'CANCELADO'` (check). |
| `motivo_cancelamento` / `cancelado_por` / `cancelado_em` | — | Não | — | Padrão par-ou-nada. |
| `created_at` / `updated_at` | `timestamptz` | Sim | `now()` | — |

### Índices

- `transferencias_origem_idx`, `transferencias_destino_idx`, `transferencias_status_idx`.

### Constraints

- **Check `transferencias_contas_diferentes`:** `conta_origem_id <> conta_destino_id` (CLAUDE.md §7 — "transferências para a mesma conta" é integridade a ser impedida).
- **Check `transferencias_cancelamento_check`:** padrão par-ou-nada.

### RLS

- `transferencias_select_authenticated` (SELECT, `authenticated`, `true`).
- `transferencias_write_tesoureiro_insert` / `transferencias_write_tesoureiro_update` (INSERT/UPDATE, `authenticated`, `public.is_tesoureiro()`) — desde `00000000000015_fase2_correcoes.sql`, sem policy de DELETE.

**Por quê:** SPEC §20 — movimentação entre contas próprias, feita por Tesoureiro/Administrador, com o mesmo padrão de cancelamento rastreável das demais tabelas financeiras.

### Triggers

- `transferencias_set_updated_at` (BEFORE UPDATE) → `public.set_updated_at()`.
- `transferencias_bloqueia_cancelamento_fechado` (BEFORE UPDATE, desde `00000000000020_financeiro_fase7.sql`) → `public.bloqueia_cancelamento_periodo_fechado()`: mesma regra de `movimentacoes` — cancelamento bloqueado se o mês de `data` já estiver `FECHADO`.

---

## Tabela: `categorias_movimentacao`

**Namespace:** `public.categorias_movimentacao` · **Migration:** `00000000000020_financeiro_fase7.sql`

**Responsabilidade:** Catálogo editável de categorias de `movimentacoes` (Fase 7) — cadastro em `/configuracoes/categorias`, mesmo padrão de `formas_pagamento`.

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `nome` | `text` | Sim | — | — |
| `tipo` | `text` | Sim | — | `'ENTRADA'` ou `'SAIDA'` (check). |
| `sistema` | `boolean` | Sim | `false` | `true` para as categorias "Mensalidade" (UUID fixo `00000000-0000-0000-0000-000000000001`, Fase 7) e "Campanha" (UUID fixo `00000000-0000-0000-0000-000000000002`, seed de `00000000000021_campanhas_fase8.sql`) — usadas exclusivamente pelos vínculos automáticos de pagamento de mensalidade e doação; nunca editáveis/removíveis pela UI nem pelo banco (ver Triggers). |
| `ativo` | `boolean` | Sim | `true` | — |
| `created_at` / `updated_at` | `timestamptz` | Sim | `now()` | — |

### Constraints

- **Unique `categorias_movimentacao_nome_tipo_key`:** `(nome, tipo)`.

### RLS

- `categorias_movimentacao_select_authenticated` (SELECT, `authenticated`, `true`).
- `categorias_movimentacao_write_admin` (ALL, `authenticated`, `public.is_admin()`) — só Administrador cadastra/edita categorias (mesmo padrão de `formas_pagamento`/`contas`).

### Triggers

- `categorias_movimentacao_set_updated_at` (BEFORE UPDATE) → `public.set_updated_at()`.
- `categorias_movimentacao_no_update_sistema` / `categorias_movimentacao_no_delete_sistema` (BEFORE UPDATE/DELETE, `when (old.sistema)`) → `public.categorias_movimentacao_bloqueia_sistema()`: lança exceção sempre, mesmo padrão do append-only de `config_mensalidade` (Fase 4) — garante a proteção mesmo contra `service_role`, que ignora RLS.

---

## Tabela: `recibos`

**Namespace:** `public.recibos` · **Migration:** `00000000000011_recibos.sql`

**Responsabilidade:** Registro do recibo emitido (PDF, gerado na Fase 10) para um pagamento de mensalidade ou uma doação de campanha.

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `tipo` | `text` | Sim | — | `'MENSALIDADE'` ou `'CAMPANHA'` (check). |
| `membro_id` | `uuid` | Não | — | FK → `membros(id)`, opcional (doação de campanha pode não ter membro). |
| `pessoa` | `text` | Sim | — | Nome exibido no recibo (membro ou doador externo). |
| `valor` | `numeric(12,2)` | Sim | — | `> 0`. |
| `referencia` | `text` | Sim | — | Texto livre (ex.: competência quitada, ou título da campanha). |
| `data` | `date` | Sim | — | — |
| `descricao` | `text` | Não | — | — |
| `assinatura_url` | `text` | Não | — | URL do PDF/assinatura em Supabase Storage (Fase 10). |
| `usuario_id` | `uuid` | Sim | — | FK → `profiles(id)` — quem emitiu. |
| `pagamento_id` | `uuid` | Não | — | FK → `pagamentos(id)`. |
| `doacao_id` | `uuid` | Não | — | FK → `doacoes(id)`. |
| `created_at` | `timestamptz` | Sim | `now()` | Sem `updated_at`: recibo não é editado (ver abaixo). |

### Índices

- `recibos_membro_idx`, `recibos_tipo_idx`, `recibos_data_idx`.

### Constraints

- **Check `recibos_origem_check`:** ou `tipo = 'MENSALIDADE'` com `pagamento_id` preenchido e `doacao_id` nulo, ou `tipo = 'CAMPANHA'` com `doacao_id` preenchido e `pagamento_id` nulo — todo recibo tem exatamente uma origem, coerente com o tipo.

### RLS

- `recibos_select_authenticated` (SELECT, `authenticated`, `true`).
- `recibos_insert_tesoureiro` (INSERT, `authenticated`, `with check public.is_tesoureiro()`).
- **Sem policy de UPDATE/DELETE.**

**Por quê:** SPEC §27 — um recibo é um documento fiscal/histórico emitido; alterá-lo ou apagá-lo depois quebraria a rastreabilidade do que foi entregue ao pagador. A tabela é insert-only por design: para corrigir um recibo emitido errado, a Fase 10 deve emitir um novo (ou registrar um cancelamento na tabela de origem), nunca fazer UPDATE.

---

## Tabela: `fechamentos_mensais`

**Namespace:** `public.fechamentos_mensais` · **Migration:** `00000000000012_fechamentos_mensais.sql`

**Responsabilidade:** Fechamento contábil mensal — snapshot consolidado de saldo/entradas/saídas do mês, com abertura/fechamento/reabertura controlados por perfil.

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `ano` | `integer` | Sim | — | `2000..2100` (check). |
| `mes` | `integer` | Sim | — | `1..12` (check). |
| `saldo_inicial` | `numeric(12,2)` | Sim | — | Saldo agregado no início do mês. |
| `total_entradas` | `numeric(12,2)` | Sim | — | — |
| `total_saidas` | `numeric(12,2)` | Sim | — | — |
| `total_transferencias` | `numeric(12,2)` | Sim | — | Volume transferido entre contas no mês (informativo — não entra na conta de `saldo_final`, pois transferência não é receita/despesa, CLAUDE.md §8). |
| `saldo_final` | `numeric(12,2)` | Sim | — | Ver constraint abaixo. |
| `status` | `text` | Sim | `'ABERTO'` | `'ABERTO'` ou `'FECHADO'` (check). |
| `fechado_por` / `fechado_em` | `uuid` / `timestamptz` | Não | — | FK → `profiles(id)` / — . |
| `reaberto_por` / `reaberto_em` | `uuid` / `timestamptz` | Não | — | FK → `profiles(id)` / — . |
| `motivo_reabertura` | `text` | Não | — | — |
| `created_at` / `updated_at` | `timestamptz` | Sim | `now()` | — |

### Índices e constraints

- `fechamentos_mensais_ano_mes_idx`, `fechamentos_mensais_status_idx`.
- **Unique `fechamentos_mensais_ano_mes_key`:** `(ano, mes)`.
- **Check `fechamentos_mensais_saldo_check`:** `saldo_final = saldo_inicial + total_entradas - total_saidas`.
- **Check `fechamentos_mensais_fechado_auditoria_check`** (adicionada por `00000000000015_fase2_correcoes.sql`): `status <> 'FECHADO' or (fechado_por is not null and fechado_em is not null)` — um fechamento não pode estar `FECHADO` sem registrar quem/quando fechou. Não força `reaberto_por`/`reaberto_em`/`motivo_reabertura` a `null` quando `status = 'ABERTO'`: depois de uma reabertura o registro volta a `ABERTO`, mas esses campos permanecem preenchidos como histórico da última reabertura.

### Limitação conhecida: bloqueio de período não é imposto pelo banco

SPEC §22 pede para "bloquear alterações normais daquele período" quando um mês está `FECHADO`. Implementado na Fase 7 com uma decisão explícita do usuário (2026-08-12): **criação** de lançamento novo (movimentação, transferência ou pagamento de mensalidade) com data retroativa dentro de um mês fechado continua permitida; só **cancelamento** é bloqueado. Para `movimentacoes`/`transferencias` isso é garantido por trigger de banco (`bloqueia_cancelamento_periodo_fechado`, ver tabelas acima), robusto mesmo contra `service_role`. Para `pagamentos`, a checagem é feita em código de aplicação (`periodoEstaFechado()` em `lib/financeiro/periodo.ts`, chamada no início de `cancelarPagamento`) em vez de trigger de banco — para não colidir com o fluxo de compensação automática já existente na Fase 6 (`compensarFalhaParcial`), que também cancela o pagamento internamente em caso de falha parcial no registro.

### RLS

- `fechamentos_select_authenticated` (SELECT, `authenticated`, `true`).
- `fechamentos_insert_tesoureiro` (INSERT, `authenticated`, `with check public.is_tesoureiro()`).
- `fechamentos_update_tesoureiro` (UPDATE, `authenticated`, `using (public.is_tesoureiro() and status = 'ABERTO')`, `with check public.is_tesoureiro()`) — Tesoureiro só edita/fecha um fechamento que ainda está `ABERTO`; depois de `FECHADO`, essa policy deixa de autorizar a linha (o `using` falha), então Tesoureiro **não consegue reabrir**.
- `fechamentos_update_admin` (UPDATE, `authenticated`, `public.is_admin()`) — sem restrição de `status` no `using`, então Administrador pode atualizar (inclusive reabrir) um fechamento em qualquer status.
- **Duas policies de UPDATE distintas** implementam a regra "Tesoureiro fecha, só Administrador reabre" diretamente no RLS (Postgres aplica `OR` entre múltiplas policies permissivas da mesma ação) — não é uma checagem só na aplicação.

**Por quê:** SPEC §22 e CLAUDE.md §10 — fechar o mês é operação financeira de rotina (Tesoureiro), mas reabrir um mês já fechado é uma exceção sensível (mexe em período supostamente encerrado) e fica reservada ao Administrador, e essa restrição precisa valer mesmo que alguém chame a API diretamente — daí ser modelada como duas policies RLS em vez de uma validação só no formulário.

### Decisão técnica: um fechamento por mês, agregado, não por conta

`fechamentos_mensais` tem exatamente uma linha por `(ano, mes)`, cobrindo **todas as contas combinadas** — não existe um fechamento por conta individual. Saldo/entrada/saída por conta continuam consultáveis a qualquer momento via `movimentacoes`/`contas` e serão expostos como um relatório à parte (SPEC §29, item 6 — "saldo por conta"), não como uma tabela de fechamento por conta. Fechar o mês é um evento contábil único da Loja como um todo.

### Triggers

`fechamentos_mensais_set_updated_at` (BEFORE UPDATE) → `public.set_updated_at()`.

---

## Tabela: `repasses_grande_loja`

**Namespace:** `public.repasses_grande_loja` · **Migration:** `00000000000013_repasses_grande_loja.sql`

**Responsabilidade:** Um envio de repasse à Grande Loja (o "lote" de envio), consolidando um ou mais itens de `repasses_grande_loja_itens`.

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `data_envio` | `date` | Sim | — | — |
| `usuario_id` | `uuid` | Sim | — | FK → `profiles(id)` — quem registrou o envio. |
| `valor_total` | `numeric(12,2)` | Sim | — | `>= 0`. |
| `observacao` | `text` | Não | — | — |
| `status` | `text` | Sim | `'ENVIADO'` | `'ENVIADO'` ou `'CANCELADO'` (check). |
| `created_at` / `updated_at` | `timestamptz` | Sim | `now()` | — |

### RLS

- `repasses_select_authenticated` (SELECT, `authenticated`, `true`).
- `repasses_write_tesoureiro_insert` / `repasses_write_tesoureiro_update` (INSERT/UPDATE, `authenticated`, `public.is_tesoureiro()`) — desde `00000000000015_fase2_correcoes.sql`, sem policy de DELETE.

**Por quê:** SPEC §15/§16 — registrar o envio à Grande Loja é operação financeira de rotina do Tesoureiro, com rastreabilidade de quem/quando (CLAUDE.md §4).

### Triggers

`repasses_grande_loja_set_updated_at` (BEFORE UPDATE) → `public.set_updated_at()`.

---

## Tabela: `repasses_grande_loja_itens`

**Namespace:** `public.repasses_grande_loja_itens` · **Migration:** `00000000000013_repasses_grande_loja.sql`

**Responsabilidade:** Um item pendente/enviado de repasse — a parcela de Grande Loja de **uma competência específica** (`mensalidades.valor_grande_loja`), rastreável desde "pendente de envio" até "incluída em um repasse enviado".

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `mensalidade_id` | `uuid` | Sim | — | FK → `mensalidades(id)`, **`unique`** — cada competência gera no máximo um item de repasse (CLAUDE.md §5: "cada competência gera seu próprio valor de Grande Loja"). |
| `repasse_id` | `uuid` | Não | — | FK → `repasses_grande_loja(id)` — **nullable por design**, ver decisão técnica abaixo. |
| `valor` | `numeric(12,2)` | Sim | — | `> 0`. |
| `status` | `text` | Sim | `'PENDENTE'` | `'PENDENTE'`, `'ENVIADO'`, `'CANCELADO'` (check). |
| `created_at` / `updated_at` | `timestamptz` | Sim | `now()` | — |

### Índices e constraints

- `repasses_itens_repasse_idx`, `repasses_itens_status_idx`.
- **Check `repasses_itens_repasse_status_check`:** ou `repasse_id is null` e `status = 'PENDENTE'`, ou `repasse_id is not null` e `status in ('ENVIADO', 'CANCELADO')` — um item só pertence a um repasse enviado depois de deixar de estar pendente, e vice-versa.

### RLS

- `repasses_itens_select_authenticated` (SELECT, `authenticated`, `true`).
- `repasses_itens_write_tesoureiro_insert` / `repasses_itens_write_tesoureiro_update` (INSERT/UPDATE, `authenticated`, `public.is_tesoureiro()`) — desde `00000000000015_fase2_correcoes.sql`, sem policy de DELETE.

**Por quê:** SPEC §15/§16 — cada competência quitada precisa gerar seu próprio valor de Grande Loja rastreável (CLAUDE.md §5), separado do "lote" de envio em si.

### Decisão técnica: `repasse_id` nullable é proposital

Diferente de um FK obrigatório, `repasse_id` começa `null` (item `PENDENTE`, ainda não incluído em nenhum envio). A **criação automática** de um item de `repasses_grande_loja_itens` no momento em que uma `mensalidade` é quitada (status → `QUITADA`) é regra de negócio da **Fase 9** (Grande Loja), não desta fase — Fase 2 só cria a estrutura da tabela e a constraint que amarra `status`/`repasse_id`. Até lá, linhas em `repasses_grande_loja_itens` só existem se inseridas manualmente/por seed.

### Triggers

`repasses_itens_set_updated_at` (BEFORE UPDATE) → `public.set_updated_at()`.

---

## Tabela: `auditoria`

**Namespace:** `public.auditoria` · **Migration:** `00000000000014_auditoria.sql`

**Responsabilidade:** Log de auditoria de operações críticas (CLAUDE.md §12) — quem fez o quê, quando, com dados antes/depois.

### Campos

| Campo | Tipo | NOT NULL | Padrão | Descrição |
|-------|------|----------|--------|-----------|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK. |
| `usuario_id` | `uuid` | Não | — | FK → `profiles(id)`. `nullable` para permitir registro de ações do sistema sem usuário interativo associado. |
| `modulo` | `text` | Sim | — | Ex.: `'PAGAMENTOS'`, `'FECHAMENTO'`, `'USUARIOS'`. |
| `acao` | `text` | Sim | — | Ex.: `'CRIAR'`, `'CANCELAR'`, `'FECHAR'`. |
| `registro_tabela` | `text` | Não | — | Nome da tabela afetada (referência textual, não FK — a auditoria precisa sobreviver mesmo que o registro original seja referenciado por múltiplas tabelas diferentes). |
| `registro_id` | `uuid` | Não | — | Id do registro afetado. |
| `dados_anteriores` | `jsonb` | Não | — | Snapshot antes da mudança. |
| `dados_novos` | `jsonb` | Não | — | Snapshot depois da mudança. |
| `descricao` | `text` | Não | — | — |
| `created_at` | `timestamptz` | Sim | `now()` | Sem `updated_at`: log nunca é editado. |

### Índices

- `auditoria_usuario_idx`, `auditoria_modulo_idx`, `auditoria_created_at_idx` (desc, para listagens recentes primeiro), `auditoria_registro_idx` em `(registro_tabela, registro_id)` (consultar histórico de um registro específico).

### RLS

- `auditoria_select_admin` (SELECT, `authenticated`, `public.is_admin()`) — só Administrador lê o log de auditoria.
- **Sem nenhuma policy de INSERT/UPDATE/DELETE client-side.** Igual ao padrão já estabelecido para `profiles` na Fase 1: a escrita em `auditoria` é feita exclusivamente por Server Actions com `service_role` (a serem implementadas junto com cada módulo que precisa auditar — pagamentos, cancelamentos, configurações, fechamento, reabertura, Grande Loja, usuários — conforme CLAUDE.md §12), nunca pelo client autenticado comum. Isso impede que um usuário (mesmo mal-intencionado com o anon key) manipule ou apague seu próprio rastro de auditoria.

**Por quê:** SPEC §30 e CLAUDE.md §12 — auditoria só tem valor se for imutável e não puder ser forjada/apagada por quem está sendo auditado; nem Tesoureiro nem Administrador conseguem escrever diretamente via client, apenas ler (Administrador).

**Nota (Fase 3):** A partir da Fase 3, toda escrita em `auditoria` passa por `lib/audit.ts` (`registrarAuditoria`), chamado pelas Server Actions administrativas — nunca diretamente do client. Ver [`docs/permissoes.md`](./permissoes.md) para a explicação completa de por que essas Server Actions (que usam `service_role`) são a única camada de autorização nesse caso.

---

## Decisões técnicas — Fase 2 (resumo)

Além das decisões documentadas junto de cada tabela acima, ficam registradas aqui para referência rápida:

1. **Consistência agregada de pagamentos não é imposta por trigger SQL.** A soma de `pagamento_mensalidades.valor_aplicado` por `mensalidade_id` deve refletir `mensalidades.valor_pago`, mas essa consistência é garantida pela camada de aplicação/domínio na Fase 6 (transação atômica de "registrar pagamento" + testes Vitest), não por trigger ou constraint SQL. Fase 2 entrega só a estrutura (FKs, constraints básicas por linha).
2. **`fechamentos_mensais` é um fechamento agregado por `(ano, mes)`, não por conta.** Não existe fechamento por conta individual; saldo por conta é relatório separado (SPEC §29, item 6).
3. **`repasses_grande_loja_itens.repasse_id` é nullable de propósito.** A criação automática de um item de repasse quando uma mensalidade é quitada é regra de negócio da Fase 9, ainda não implementada — Fase 2 só entrega a tabela e a constraint que amarra `status` a `repasse_id`; a constraint foi corrigida em `00000000000015_fase2_correcoes.sql` para permitir `CANCELADO` mesmo com `repasse_id is null`.
4. **Mapa de escrita por perfil via RLS:**
   - **Administrador** (`is_admin()`): escreve em tudo, incluindo `membros`, `contas`, `formas_pagamento`, `loja_config`, `config_mensalidade` (que Tesoureiro não escreve), e é o único que pode **reabrir** um `fechamentos_mensais` (`fechamentos_update_admin`).
   - **Tesoureiro** (`is_tesoureiro()`, que também é `true` para Administrador): escreve em `mensalidades`, `pagamentos`, `pagamento_mensalidades`, `movimentacoes`, `transferencias`, `campanhas`, `doacoes`, `repasses_grande_loja`/`repasses_grande_loja_itens`; só **insere** em `recibos` (sem update/delete); pode **fechar** (`fechamentos_insert_tesoureiro`/`fechamentos_update_tesoureiro`, este último só enquanto `status = 'ABERTO'`) mas não reabrir um `fechamentos_mensais`.
   - A restrição "só Administrador reabre" é enforced com **duas policies RLS de UPDATE separadas** (`fechamentos_update_tesoureiro` com `status = 'ABERTO'` no `using`, e `fechamentos_update_admin` sem essa restrição) — não é validação só na aplicação.
   - **Consulta:** somente leitura em todas as tabelas com policy de `select` (todas exceto `auditoria`, que é exclusiva de Administrador).
5. **`recibos` é insert-only**, sem policy de UPDATE/DELETE — mesmo padrão de imutabilidade já usado em `auditoria` (Fase 1/2, sem nenhuma policy de escrita client-side) e em `config_mensalidade` (insert-only, sem update/delete). Corrigir um recibo/config errado nunca é um UPDATE, é uma nova linha (ou, no caso de `auditoria`, nem isso — é escrita via `service_role` apenas).
6. **DELETE fechado por RLS em 13 tabelas.** `00000000000015_fase2_correcoes.sql` fechou as policies `for all` originais (que concediam DELETE implícito) de `loja_config`, `membros`, `contas`, `formas_pagamento`, `campanhas`, `mensalidades`, `pagamentos`, `pagamento_mensalidades`, `doacoes`, `movimentacoes`, `transferencias`, `repasses_grande_loja` e `repasses_grande_loja_itens`, substituindo-as por policies de `insert`/`update` — sem policy de `delete`, o RLS nega exclusão física por padrão.

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

Essas operações não possuem políticas RLS no client. Em vez disso, são executadas via Server Action Next.js com credencial `service_role`, que contorna RLS e permite implementar lógica crítica de negócio (validações, auditoria, logs). Nota: "Deletar usuário" aqui é diferente do bloqueio de DELETE fechado por `00000000000015_fase2_correcoes.sql` nas 13 tabelas financeiras/cadastrais (`membros`, `contas`, etc.) — naquelas, o DELETE client-side é negado pelo RLS por não existir policy correspondente; aqui, `profiles` nem tem policy de escrita client-side alguma, e a exclusão (quando implementada na Fase 3) passa inteiramente por `service_role`, que ignora RLS.

Essa separação entre read-only (RLS strict) e write (service role centralizado) é padrão em aplicações financeiras.

---

## Migrations e Versionamento

Migrations SQL são versionadas numericamente sob `supabase/migrations/`:

- `00000000000001_profiles.sql` — Tabela `profiles` com RLS e trigger `set_updated_at()`.
- `00000000000002_auth_helpers.sql` — Funções `current_profile_role()`, `is_admin()`, `is_tesoureiro()`.
- `00000000000003_loja_config_mensalidade.sql` — `loja_config`, `config_mensalidade`.
- `00000000000004_membros.sql` — `membros`.
- `00000000000005_contas_formas_pagamento.sql` — `contas`, `formas_pagamento`.
- `00000000000006_campanhas.sql` — `campanhas`.
- `00000000000007_mensalidades.sql` — `mensalidades`.
- `00000000000008_pagamentos.sql` — `pagamentos`, `pagamento_mensalidades`.
- `00000000000009_doacoes.sql` — `doacoes`.
- `00000000000010_movimentacoes_transferencias.sql` — `movimentacoes`, `transferencias`.
- `00000000000011_recibos.sql` — `recibos`.
- `00000000000012_fechamentos_mensais.sql` — `fechamentos_mensais`.
- `00000000000013_repasses_grande_loja.sql` — `repasses_grande_loja`, `repasses_grande_loja_itens`.
- `00000000000014_auditoria.sql` — `auditoria`.
- `00000000000015_fase2_correcoes.sql` — Correções do review final da Fase 2: (1) fecha as policies `for all` de 13 tabelas financeiras/cadastrais que concediam DELETE implícito, substituindo-as por policies separadas de `insert`/`update` sem policy de `delete`; (2) aperta `pagamento_mensalidades.pagamento_id` de `on delete cascade` para `on delete restrict`; (3) corrige `repasses_itens_repasse_status_check` para permitir um item ainda não agrupado em repasse (`repasse_id is null`) ser marcado `CANCELADO`; (4) adiciona `fechamentos_mensais_fechado_auditoria_check` exigindo `fechado_por`/`fechado_em` quando `status = 'FECHADO'`.
- `00000000000016_loja_assets.sql` — Fase 4: adiciona `loja_config.assinatura_url` e cria o bucket de Storage `loja-assets` (público para leitura, escrita restrita a `is_admin()`), usado originalmente por logo e assinatura de recibo.
- `00000000000017_loja_config_seed.sql` — Fase 4, revisão do review final: garante via `insert ... on conflict do nothing` que a linha singleton `loja_config(id=1)` sempre existe (o seed com esses dados é dev-only, não aplicado em produção); também aplica `file_size_limit`/`allowed_mime_types` ao bucket `loja-assets`.
- `00000000000018_assinaturas_privadas.sql` — Fase 4, revisão: cria o bucket privado `loja-assinaturas` (`public: false`) para a assinatura de recibo, que passa a não usar mais `loja-assets` (correção de vazamento — a assinatura autentica documentos financeiros e não deveria ser publicamente legível como o logo).
- `00000000000019_config_mensalidade_append_only.sql` — Fase 4, revisão: adiciona triggers `BEFORE UPDATE`/`BEFORE DELETE` em `config_mensalidade` que sempre lançam exceção, garantindo o append-only mesmo para escritas via `service_role` (que ignora RLS).
- `00000000000020_financeiro_fase7.sql` — Fase 7: cria `categorias_movimentacao` (com trigger que protege a categoria de sistema "Mensalidade"), troca `movimentacoes.categoria` (texto livre) por `categoria_id` (FK), e adiciona o trigger `bloqueia_cancelamento_periodo_fechado` em `movimentacoes`/`transferencias`.
- `00000000000021_campanhas_fase8.sql` — Fase 8: seed da categoria de sistema "Campanha" (ENTRADA) em `categorias_movimentacao`, usada pelo vínculo automático de doação.

`supabase/seed.sql` (não numerado, não é migration) contém dados de desenvolvimento: formas de pagamento padrão e a linha singleton de `loja_config`. Não é aplicado automaticamente em produção.

**Regra crítica:** Migrations nunca são editadas após aplicação em um banco de dados real. Se houver erro, cria-se uma nova migration para corrigir.

---

## Deploy

- Migrations são aplicadas via `supabase db push` (ambiente local/dev) ou via Supabase Dashboard (produção).
- Migrations não são idempotentes em geral (usam `create table`/`create policy` puros): cada arquivo deve ser executado exatamente uma vez contra um dado banco. `00000000000001_profiles.sql`, em particular, não pode ser colado novamente no SQL Editor após já ter sido aplicado — rodaria em erro por objetos já existentes. Ver a "Opção B" em `docs/instalacao.md`, que é uma alternativa ao `supabase db push` para a primeira aplicação, não um passo repetível.
- Alterações estruturais em produção exigem planejamento de downtime mínimo.

---

## Próximas Fases

- **Fase 3:** Permissões granulares e Server Actions de administração de usuários (CRUD de `profiles` via `service_role`).
- **Fase 4:** Interface de Configurações (edição de `loja_config`/`config_mensalidade` pelo Administrador).
- **Fase 5:** Cadastro de membros (UI sobre `membros`).
- **Fase 6:** Mensalidades e pagamentos — geração de competências, registro de pagamento (parcial/atrasado/acima do valor), e a lógica de domínio que mantém `pagamento_mensalidades` consistente com `mensalidades.valor_pago` (ver decisão técnica na seção `pagamento_mensalidades` acima).
- **Fase 7/8:** Financeiro (movimentações, transferências) e campanhas/doações.
- **Fase 9:** Grande Loja — geração automática de itens de `repasses_grande_loja_itens` ao quitar uma mensalidade.
- **Fase 10:** Recibos em PDF.
- **Fase 11+:** Relatórios, dashboard, segurança/revisão, testes, deploy — conforme CLAUDE.md §14.
