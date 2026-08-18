# Balancete Financeiro Analítico — Design

Data: 2026-08-18

## Contexto

O relatório financeiro atual (`/relatorios/financeiro`) é uma lista plana de todas as movimentações do período, sem agrupamento. Para leitura contábil (visão gerencial "quanto entrou/saiu por categoria, e onde exatamente") é preciso abrir o CSV/PDF e somar manualmente.

O sistema já modela:

- `contas` — contas bancárias/caixa físicas (Banco, Caixa).
- `categorias_movimentacao` — categorias de entrada/saída (ex.: Mensalidade, Tronco, Recebimentos, Despesas, Custos, Pagamentos avulsos). Cada categoria tem `tipo` (`ENTRADA` ou `SAIDA`).
- `movimentacoes` — lançamentos individuais, cada um ligado a uma `conta_id` e uma `categoria_id`, com `status` (`ATIVO`/`CANCELADO`).
- `transferencias` — movimentações entre contas (não são receita/despesa).

Já existe `/relatorios/saldos`, que mostra saldo por conta bancária (sem drill-down). Este documento não altera esse relatório.

## Objetivo

Adicionar um novo relatório, **Balancete Financeiro**, que:

1. Agrupa as movimentações do período por **categoria** (a "conta contábil" deste sistema), separadas em duas seções: Entradas e Saídas.
2. Mostra o total de cada categoria.
3. Ao clicar em uma categoria, expande inline a lista de lançamentos que compõem aquele total (data, descrição, conta, forma de pagamento, valor).
4. Mostra subtotais de Entradas e Saídas e o saldo do período (Entradas − Saídas).

Este relatório é **adicional** — o relatório "Movimentação de entradas e saídas" (lista plana) continua existindo sem alterações.

## Fora de escopo

- Transferências entre contas **não entram** neste balancete (não são receita nem despesa; continuam representadas apenas em `/relatorios/saldos`).
- Não altera `/relatorios/financeiro` nem `/relatorios/saldos`.
- Não adiciona filtros de conta/forma de pagamento/membro/campanha — só filtro de período (De/Até), pois o agrupamento primário já é por categoria.
- Não introduz uma hierarquia de "plano de contas" configurável — usa as categorias já existentes em `categorias_movimentacao`.

## Modelo de dados (novo arquivo `lib/relatorios/balancete.ts`)

Nenhuma migration nova é necessária — os dados já existem em `movimentacoes` + `categorias_movimentacao`.

```ts
export type FiltrosBalancete = {
  dataInicio?: string
  dataFim?: string
}

export type LancamentoBalancete = {
  data: string          // YYYY-MM-DD
  descricao: string
  conta: string
  formaPagamento: string
  valor: number
}

export type CategoriaBalancete = {
  id: string
  nome: string
  total: number
  lancamentos: LancamentoBalancete[]
}

export type GrupoBalancete = {
  tipo: 'ENTRADA' | 'SAIDA'
  label: string          // "Entradas" | "Saídas"
  total: number
  categorias: CategoriaBalancete[]
}

export type Balancete = {
  grupos: GrupoBalancete[]   // sempre 2 posições: ENTRADA depois SAIDA
  totalEntradas: number
  totalSaidas: number
  saldoPeriodo: number
}

export async function buscarBalancete(
  supabase: SupabaseClient,
  filtros: FiltrosBalancete
): Promise<Balancete>
```

Implementação:

1. Query única em `movimentacoes` com `status = 'ATIVO'`, filtrando por `data >= dataInicio` / `data <= dataFim` quando informados, com join em `categorias_movimentacao(id, nome, tipo)`, `contas(nome)`, `formas_pagamento(nome)`.
2. Agrupar em memória (reduce) por `categoria_id`, somando `valor` e empilhando o lançamento formatado.
3. Categorias sem nenhum lançamento no período **não aparecem** na lista (evita ruído de categorias zeradas).
4. Ordenação: categorias em ordem alfabética dentro de cada grupo; grupo Entradas sempre antes de Saídas.
5. `totalEntradas`/`totalSaidas`/`saldoPeriodo` calculados a partir dos totais de categoria (não de uma segunda query).

## Interface

### Página `/relatorios/balancete` (`app/(app)/relatorios/balancete/page.tsx`)

Server component, seguindo o mesmo padrão das outras páginas de relatório:

- Formulário com dois campos de data (`De` / `Até`), botão "Filtrar" (GET, via query string — mesmo padrão de `paramsParaQueryString`).
- Cards de resumo: Entradas, Saídas, Saldo do período (mesmo componente visual `<dl>` já usado em `ResultadoRelatorioView`).
- Botões de exportação PDF e CSV (`/relatorios/balancete/pdf`, `/relatorios/balancete/csv`), preservando a query string do filtro.
- Componente `BalanceteTable` (novo, client component) para a tabela interativa.

### Componente `BalanceteTable` (novo, `app/(app)/relatorios/balancete/BalanceteTable.tsx`)

Client component, mesmo padrão de accordion do `HistoricoRepasses.tsx` (estado local `expandido: string | null`, um único item aberto por vez):

- Renderiza os dois grupos em sequência (Entradas, Saídas), cada um com um cabeçalho de seção e uma linha de subtotal ao final do grupo.
- Cada linha de categoria é clicável (`onClick` alterna `expandido`); ao abrir, insere uma linha estendida (`colSpan`) com a subtabela de lançamentos daquela categoria (data formatada `formatarDataBR`, descrição, conta, forma de pagamento, valor formatado `formatarMoedaBR`).
- Se uma categoria não tiver lançamentos no período ela não aparece (já filtrado na camada de dados).
- Estado vazio: se `grupos` não tiver nenhuma categoria em nenhum dos dois grupos, mostrar "Nenhuma movimentação encontrada para o período selecionado." (mesmo texto/padrão dos outros relatórios).

### Exportação (PDF/CSV)

Reaproveita a infraestrutura existente (`gerarPdfTabela`, `gerarCsv`, mesmo padrão de `app/(app)/relatorios/financeiro/{pdf,csv}/route.ts`), através de uma função de achatamento:

```ts
export function balanceteParaResultado(balancete: Balancete): ResultadoRelatorio
```

Formato achatado (uma linha por categoria com o total, seguida das linhas de detalhe de cada lançamento, com indicação visual de nível — ex.: prefixo `"— "` nas linhas de detalhe):

```
Colunas: ['Categoria / Lançamento', 'Data', 'Conta', 'Forma', 'Valor']

ENTRADAS
Mensalidade (subtotal)            —      —      —      R$ 1.200,00
  — Pagamento João Silva           03/08  Banco  PIX    R$ 300,00
  — Pagamento Maria Souza          10/08  Caixa  Dinheiro R$ 300,00
  ...
Tronco (subtotal)                 —      —      —      R$ 150,00
  ...
SAÍDAS
Despesas (subtotal)               —      —      —      R$ 400,00
  ...
```

Os `resumo` (cards) do `ResultadoRelatorio` levam Entradas/Saídas/Saldo do período, iguais aos da tela.

Rotas novas: `app/(app)/relatorios/balancete/pdf/route.ts` e `app/(app)/relatorios/balancete/csv/route.ts`, espelhando exatamente o padrão de `financeiro/pdf` e `financeiro/csv`.

### Navegação

Adicionar entrada na lista de `app/(app)/relatorios/page.tsx`:

```ts
{ titulo: 'Balancete financeiro (analítico)', href: '/relatorios/balancete' }
```

## Erros e estados

- Sem autenticação → `AcessoNegado` (mesmo padrão das outras páginas de relatório).
- Sem movimentações no período → mensagem de vazio (ver acima).
- Filtro de data inválido (`dataFim < dataInicio`) → não há validação hoje nos outros relatórios de período; manter consistência e não validar (mesmo comportamento das demais páginas de relatório: query simplesmente não retorna nada com filtro contraditório).

## Testes

- Teste unitário para `buscarBalancete`: agrupamento correto por categoria/tipo, exclusão de movimentações `CANCELADO`, exclusão de categorias sem lançamento no período, cálculo de `saldoPeriodo`.
- Teste unitário para `balanceteParaResultado`: achatamento correto (uma linha de subtotal por categoria + N linhas de detalhe, na ordem esperada).
- Verificação manual na UI: abrir `/relatorios/balancete`, aplicar filtro de período, expandir/colapsar categorias, exportar PDF e CSV.

## Arquivos afetados

Novos:
- `lib/relatorios/balancete.ts`
- `app/(app)/relatorios/balancete/page.tsx`
- `app/(app)/relatorios/balancete/BalanceteTable.tsx`
- `app/(app)/relatorios/balancete/pdf/route.ts`
- `app/(app)/relatorios/balancete/csv/route.ts`

Alterado:
- `app/(app)/relatorios/page.tsx` (nova entrada na lista)
