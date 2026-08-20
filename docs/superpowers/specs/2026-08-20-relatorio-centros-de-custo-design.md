# Relatório por Centro de Custo

Data: 2026-08-20

## Objetivo

Adicionar um relatório dedicado em `/relatorios`, no padrão dos demais relatórios do sistema (Balancete, Financeiro, Grande Loja etc.), que detalha entradas/saídas/saldo por centro de custo — com exportação em PDF e CSV — complementando o dashboard visual "Visão geral" já existente em `/financeiro`.

## Reaproveitamento da Fase anterior

A feature de centros de custo (migration `00000000000029_centros_de_custo.sql`, `lib/relatorios/centros-de-custo.ts`, dashboard "Visão geral" em `/financeiro`) já está em produção. Este relatório reaproveita `buscarDadosCentrosDeCusto(supabase, filtros)` e o tipo `CentroDeCustoResumo` como fonte de dados — **nenhuma alteração é feita em `lib/relatorios/centros-de-custo.ts`**, para não introduzir risco de regressão no dashboard já revisado e mergeado.

## Novo módulo: `lib/relatorios/centros-de-custo-relatorio.ts`

Funções puras (sem I/O, testadas com vitest), no mesmo espírito de `lib/relatorios/balancete.ts` (agrupar → `...paraResultado`):

### Filtro por centro específico

```ts
export function filtrarCentroDeCusto(
  centros: CentroDeCustoResumo[],
  centroDeCustoId?: string
): CentroDeCustoResumo[]
```

Se `centroDeCustoId` for informado, retorna só o centro com esse `id` (array de 0 ou 1 elemento); caso contrário retorna `centros` inalterado. `centroDeCustoId` pode ser o UUID de um centro real ou o valor de `SEM_CENTRO_ID` (já exportado por `lib/relatorios/centros-de-custo.ts`) para isolar a pseudo-categoria "Sem centro de custo".

### Detalhamento em 3 níveis (centro → categoria → lançamentos)

`CentroDeCustoResumo.movimentacoes` já traz cada lançamento com o nome da categoria (campo `categoria: string`), mas não agrupado. Esta função reagrupa por nome de categoria dentro de cada centro:

```ts
export type LancamentoCentroDetalhado = { data: string; descricao: string; valor: number }
export type CategoriaCentroDetalhada = {
  nome: string
  tipo: 'ENTRADA' | 'SAIDA'
  total: number
  lancamentos: LancamentoCentroDetalhado[]
}
export type CentroDeCustoDetalhado = {
  id: string
  nome: string
  cor: string
  totalEntradas: number
  totalSaidas: number
  saldo: number
  categorias: CategoriaCentroDetalhada[]
}

export function detalharCentrosDeCusto(centros: CentroDeCustoResumo[]): CentroDeCustoDetalhado[]
```

Categorias dentro de cada centro ordenadas por valor total decrescente (mesma convenção já usada em `CentroDeCustoResumo.porCategoria`); lançamentos ordenados por data decrescente.

### Achatamento para exportação PDF/CSV

```ts
export function centrosDeCustoParaResultado(centros: CentroDeCustoDetalhado[]): ResultadoRelatorio
```

Mesma estrutura de `balanceteParaResultado`: uma linha de cabeçalho por centro (com totais), uma linha de subtotal por categoria, e uma linha por lançamento — usando `formatarDataBR`/`formatarMoedaBR`.

## Tela — `/relatorios/centros-de-custo`

Novo arquivo `app/(app)/relatorios/centros-de-custo/page.tsx`, seguindo o padrão de `app/(app)/relatorios/balancete/page.tsx`:

- Guarda de acesso: qualquer usuário autenticado (`!user` → `AcessoNegado`); sem exigência de role, igual aos demais relatórios (somente leitura).
- Formulário de filtro: `De`/`Até` (mesmo padrão de data dos outros relatórios) + `select` "Centro de custo" com opções "Todos", cada centro ativo (`nome`), e "Sem centro de custo" (`value={SEM_CENTRO_ID}`).
- Busca: `buscarDadosCentrosDeCusto(supabase, { dataInicio, dataFim })` → `filtrarCentroDeCusto(..., params.centroDeCustoId)` → `detalharCentrosDeCusto(...)`.
- Cards de totais do período filtrado: Entradas, Saídas, Saldo (soma de todos os centros exibidos — se filtrado por um centro, é o total daquele centro).
- Nota informativa (texto fixo, abaixo do título): "Uma categoria pode pertencer a mais de um centro de custo. Quando isso ocorre, a movimentação aparece em todos os centros vinculados, e a soma dos centros pode ultrapassar o total geral do período." — mesma linguagem/decisão já documentada na spec do dashboard.
- Botões PDF/CSV, preservando os filtros ativos na query string (reaproveita `paramsParaQueryString` de `lib/relatorios/query.ts`).
- Tabela: novo client component `CentrosDeCustoRelatorioTable.tsx`, estendendo o padrão de `BalanceteTable.tsx` em um nível: centro (expansível) → categoria (expansível) → lançamentos. Estado vazio: "Nenhuma movimentação encontrada para o período selecionado." quando não há centros com movimentação.

## Exportação

- `app/(app)/relatorios/centros-de-custo/pdf/route.ts` — mesmo padrão de `balancete/pdf/route.ts` (`gerarPdfTabela` + `buscarCabecalhoLoja`), usando `centrosDeCustoParaResultado`.
- `app/(app)/relatorios/centros-de-custo/csv/route.ts` — mesmo padrão de `balancete/csv/route.ts` (`gerarCsv`), usando `centrosDeCustoParaResultado`.

## Navegação

Adicionar ao array `RELATORIOS` em `app/(app)/relatorios/page.tsx`:

```ts
{ titulo: 'Relatório por centro de custo', href: '/relatorios/centros-de-custo' },
```

## Testes

`lib/relatorios/centros-de-custo-relatorio.test.ts` (vitest), cobrindo:
- `filtrarCentroDeCusto`: sem `centroDeCustoId` retorna tudo; com um id existente retorna só aquele centro; com `SEM_CENTRO_ID` retorna só a pseudo-categoria; com id inexistente retorna array vazio.
- `detalharCentrosDeCusto`: agrupa lançamentos de um centro por nome de categoria corretamente; soma total por categoria bate com a soma dos lançamentos; múltiplas categorias no mesmo centro ficam em entradas separadas; centro sem movimentações produz `categorias: []`.
- `centrosDeCustoParaResultado`: gera linha de cabeçalho por centro com totais formatados; linha de subtotal por categoria; linha por lançamento; centro sem movimentação não aparece na saída (mesma convenção de `balanceteParaResultado`, que pula grupos vazios).

## Fora de escopo

- Não altera `lib/relatorios/centros-de-custo.ts`, o dashboard "Visão geral" (`/financeiro`), nem qualquer regra financeira (competência, rateio, Grande Loja).
- Não adiciona novo mecanismo de reconciliação para a sobreposição de totais entre centros — comportamento intencional, já decidido na feature anterior, apenas tornado explícito ao usuário via a nota informativa na tela.
