# Dashboard de Centros de Custo — Financeiro

Data: 2026-08-19

## Objetivo

Dar visibilidade organizada ao financeiro da Loja agrupando movimentações por **centro de custo**, um agrupamento de categorias definido pelo usuário em Configurações. A tela Financeiro passa a abrir numa visão geral visual (cards por centro de custo, com gráfico) em vez de abrir direto na tabela crua de movimentações.

## Modelo de dados

Nova migration `supabase/migrations/00000000000029_centros_de_custo.sql`:

### `centros_de_custo`

| coluna | tipo | regra |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| nome | text | not null, unique |
| cor | text | not null, hex (ex: `#0f172a`), default de uma paleta pré-definida |
| ativo | boolean | not null, default true |
| created_at | timestamptz | not null, default now() |

### `centros_de_custo_categorias` (N:N)

| coluna | tipo | regra |
|---|---|---|
| centro_de_custo_id | uuid | FK → centros_de_custo(id) on delete cascade |
| categoria_id | uuid | FK → categorias_movimentacao(id) on delete cascade |

PK composta `(centro_de_custo_id, categoria_id)`.

**Uma categoria pode pertencer a mais de um centro de custo.** Consequência aceita: a soma dos totais exibidos nos cards pode ultrapassar o total geral do período quando houver categorias compartilhadas entre centros. Não há reconciliação/alerta para isso — comportamento intencional.

Categorias sem nenhum centro associado são agregadas num card fixo **"Sem centro de custo"** na UI (não requer registro no banco).

### RLS

Seguir o padrão das demais tabelas de configuração (`categorias_movimentacao`, `contas`, `formas_pagamento`): leitura para qualquer usuário autenticado, escrita restrita a `ADMINISTRADOR` (validada server-side via `requireAdmin`, não apenas RLS).

## Configurações → Centros de custo

Nova rota `/configuracoes/centros-de-custo`, com link adicionado à página `/configuracoes` (mesmo padrão visual de Categorias).

- **Criar centro de custo**: formulário com `nome` e `cor` (input `type=color` ou seletor de paleta fixa).
- **Listar/editar centros**: cada centro mostra nome, cor, toggle ativo/inativo, e um painel de seleção de categorias — checkboxes agrupados em "Entrada" e "Saída", listando todas as `categorias_movimentacao` ativas (reaproveita a query já usada em `/configuracoes/categorias`).
- Salvar a seleção de categorias substitui o conjunto de vínculos daquele centro (delete + insert transacional simples via service role).
- Apenas `ADMINISTRADOR` acessa a página (mesma guarda de `/configuracoes/categorias/page.tsx`).
- Auditoria via `registrarAuditoria`, módulo `configuracoes`:
  - `CRIACAO_CENTRO_CUSTO` (dados novos: nome, cor)
  - `EDICAO_CENTRO_CUSTO` (nome/cor/ativo — anteriores e novos)
  - `EDICAO_CATEGORIAS_CENTRO_CUSTO` (lista anterior e nova de categoria_ids)

## Tela Financeiro

### Navegação

`FinanceiroTabs` passa a ter:

1. **Visão geral** — `/financeiro` (nova rota padrão)
2. **Movimentações** — `/financeiro/movimentacoes` (conteúdo atual de `page.tsx`: filtros + `MovimentacoesTable`, movido sem alteração de lógica)
3. Nova movimentação — `/financeiro/nova` (inalterado)
4. Transferências — `/financeiro/transferencias` (inalterado)
5. Fechamento mensal — `/financeiro/fechamento` (inalterado)

Links que hoje apontam para `/financeiro` esperando a tabela (ex.: "Ver todas" em `/dashboard`) passam a apontar para `/financeiro/movimentacoes`.

### Aba "Visão geral" (`/financeiro/page.tsx`)

- Seletor de período (De/Até), padrão = mês atual, mesmo componente/padrão usado no Dashboard geral (`/dashboard`).
- Busca todas as movimentações `ATIVO` do período uma única vez (server-side), com categoria.
- Nova função `lib/relatorios/centros-de-custo.ts` → `buscarDadosCentrosDeCusto(supabase, filtros)`:
  - Carrega `centros_de_custo` (ativos) + vínculos `centros_de_custo_categorias`.
  - Agrupa as movimentações do período por categoria, depois por centro (uma movimentação pode contar em múltiplos centros se a categoria estiver em mais de um).
  - Categorias sem nenhum centro vinculado são agregadas em um pseudo-centro `SEM_CENTRO`.
  - Retorna por centro: `{ id, nome, cor, totalEntradas, totalSaidas, saldo, porCategoria: [{ categoriaId, nome, tipo, valor }], movimentacoes: [{ id, data, categoria, descricao, valor, tipo }] }`.
- **Grid de cards** (client component `CentroDeCustoCard` dentro de `CentrosDeCustoGrid`):
  - Cada card: barra/faixa na cor do centro, nome, total entradas (verde), total saídas (vermelho), saldo, mini gráfico SVG (barra ou donut simples, sem dependência nova — segue o padrão de `GraficoEntradasSaidas.tsx`, SVG puro).
  - Card "Sem centro de custo" sempre visível por último se houver movimentações não categorizadas em nenhum centro.
  - Estado vazio: se não houver nenhum centro de custo cadastrado, mostrar mensagem + link para `/configuracoes/centros-de-custo`.
- **Clique no card** abre um modal (client-side, dados já vieram do servidor — sem nova requisição) com:
  - Resumo (entradas, saídas, saldo do centro no período).
  - Breakdown por categoria (lista ordenada por valor, com % do total do centro).
  - Tabela das movimentações do centro no período (data, categoria, descrição, valor, tipo).
- Página acessível a todos os perfis com acesso a Financeiro (somente leitura); nenhuma ação de edição nessa aba.

## Fora de escopo

- Não há alteração nas regras financeiras (competência, rateio, Grande Loja, cancelamento) — este trabalho é puramente de apresentação/organização visual sobre dados já existentes.
- Não adiciona biblioteca de gráficos nova (mantém SVG puro, consistente com `GraficoEntradasSaidas.tsx`).
- Não altera `MovimentacoesTable`, `NovaMovimentacaoForm`, fechamento ou transferências além de mover a rota.
