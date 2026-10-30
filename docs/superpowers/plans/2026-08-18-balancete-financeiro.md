# Balancete Financeiro Analítico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um novo relatório "Balancete financeiro (analítico)" que agrupa movimentações do período por categoria (Entradas/Saídas), com totais por categoria e drill-down inline dos lançamentos que compõem cada total.

**Architecture:** Camada de dados pura (`lib/relatorios/balancete.ts`) separa a lógica de agrupamento (testável sem banco) da busca no Supabase. Página server component com formulário de filtro de período + componente client `BalanceteTable` (accordion, mesmo padrão já usado em `HistoricoRepasses.tsx`). Exportação PDF/CSV reaproveita a infraestrutura genérica (`gerarPdfTabela`, `gerarCsv`) já usada pelos outros relatórios, através de uma função de achatamento.

**Tech Stack:** Next.js (App Router, server components), TypeScript, Supabase (`@supabase/ssr`), Tailwind CSS, Vitest (testes unitários), `pdf-lib` (PDF).

## Global Constraints

- Datas exibidas em `DD/MM/AAAA` via `formatarDataBR` (`lib/format.ts`).
- Valores monetários exibidos como `R$ 1.234,56` via `formatarMoedaBR` (`lib/format.ts`).
- Só movimentações com `status = 'ATIVO'` entram no balancete (mesmo filtro dos outros relatórios financeiros).
- Transferências entre contas **não** entram neste relatório (não são receita/despesa).
- Categorias sem nenhum lançamento no período filtrado **não aparecem** na lista.
- Nenhuma migration nova — os dados já existem em `movimentacoes` + `categorias_movimentacao`.
- Relatório é **adicional**: não altera `/relatorios/financeiro` nem `/relatorios/saldos`.

---

### Task 1: Camada de dados — agrupamento por categoria (lógica pura + testes)

**Files:**
- Create: `lib/relatorios/balancete.ts`
- Test: `lib/relatorios/balancete.test.ts`

**Interfaces:**
- Consumes: `ResultadoRelatorio` de `lib/relatorios/tipos.ts` (`{ titulo, subtitulo?, resumo?, colunas, linhas }`); `formatarDataBR`, `formatarMoedaBR` de `lib/format.ts`; `createSupabaseServerClient` de `lib/supabase/server.ts` (só para o tipo do parâmetro `supabase`).
- Produces (usados nas Tasks 2 e 3):
  - `type FiltrosBalancete = { dataInicio?: string; dataFim?: string }`
  - `type LancamentoBalancete = { data: string; descricao: string; conta: string; formaPagamento: string; valor: number }`
  - `type CategoriaBalancete = { id: string; nome: string; total: number; lancamentos: LancamentoBalancete[] }`
  - `type GrupoBalancete = { tipo: 'ENTRADA' | 'SAIDA'; label: string; total: number; categorias: CategoriaBalancete[] }`
  - `type Balancete = { grupos: GrupoBalancete[]; totalEntradas: number; totalSaidas: number; saldoPeriodo: number }`
  - `function agruparMovimentacoesEmBalancete(movimentacoes: MovimentacaoBrutaBalancete[]): Balancete` (pura, testada diretamente)
  - `async function buscarBalancete(supabase, filtros: FiltrosBalancete): Promise<Balancete>`
  - `function balanceteParaResultado(balancete: Balancete): ResultadoRelatorio` (pura, testada diretamente)

- [ ] **Step 1: Escrever os testes (falhando) de `agruparMovimentacoesEmBalancete`**

Criar `lib/relatorios/balancete.test.ts`:

```ts
// lib/relatorios/balancete.test.ts
import { describe, expect, it } from 'vitest'
import { agruparMovimentacoesEmBalancete, balanceteParaResultado, type MovimentacaoBrutaBalancete } from './balancete'

function mov(overrides: Partial<MovimentacaoBrutaBalancete> = {}): MovimentacaoBrutaBalancete {
  return {
    data: '2026-08-10',
    descricao: 'Lançamento teste',
    valor: 100,
    categorias_movimentacao: { id: 'cat-1', nome: 'Mensalidade', tipo: 'ENTRADA' },
    contas: { nome: 'Banco' },
    formas_pagamento: { nome: 'PIX' },
    ...overrides,
  }
}

describe('agruparMovimentacoesEmBalancete', () => {
  it('agrupa duas movimentações da mesma categoria e soma o total', () => {
    const resultado = agruparMovimentacoesEmBalancete([
      mov({ valor: 100 }),
      mov({ valor: 50 }),
    ])

    const grupoEntradas = resultado.grupos.find((g) => g.tipo === 'ENTRADA')!
    expect(grupoEntradas.categorias).toHaveLength(1)
    expect(grupoEntradas.categorias[0].total).toBe(150)
    expect(grupoEntradas.categorias[0].lancamentos).toHaveLength(2)
  })

  it('separa categorias de ENTRADA e SAIDA em grupos distintos com totais corretos', () => {
    const resultado = agruparMovimentacoesEmBalancete([
      mov({ valor: 200, categorias_movimentacao: { id: 'cat-1', nome: 'Mensalidade', tipo: 'ENTRADA' } }),
      mov({ valor: 80, categorias_movimentacao: { id: 'cat-2', nome: 'Despesas', tipo: 'SAIDA' } }),
    ])

    expect(resultado.totalEntradas).toBe(200)
    expect(resultado.totalSaidas).toBe(80)
    expect(resultado.saldoPeriodo).toBe(120)
  })

  it('não inclui categorias sem nenhum lançamento (lista vazia de entrada)', () => {
    const resultado = agruparMovimentacoesEmBalancete([])

    expect(resultado.grupos.every((g) => g.categorias.length === 0)).toBe(true)
    expect(resultado.totalEntradas).toBe(0)
    expect(resultado.totalSaidas).toBe(0)
    expect(resultado.saldoPeriodo).toBe(0)
  })

  it('ordena categorias alfabeticamente dentro do grupo', () => {
    const resultado = agruparMovimentacoesEmBalancete([
      mov({ categorias_movimentacao: { id: 'cat-t', nome: 'Tronco', tipo: 'ENTRADA' } }),
      mov({ categorias_movimentacao: { id: 'cat-m', nome: 'Mensalidade', tipo: 'ENTRADA' } }),
    ])

    const grupoEntradas = resultado.grupos.find((g) => g.tipo === 'ENTRADA')!
    expect(grupoEntradas.categorias.map((c) => c.nome)).toEqual(['Mensalidade', 'Tronco'])
  })

  it('aceita relação de categoria/conta/forma como array (formato alternativo do Supabase)', () => {
    const resultado = agruparMovimentacoesEmBalancete([
      mov({
        categorias_movimentacao: [{ id: 'cat-1', nome: 'Mensalidade', tipo: 'ENTRADA' }],
        contas: [{ nome: 'Caixa' }],
        formas_pagamento: [{ nome: 'Dinheiro' }],
      }),
    ])

    const categoria = resultado.grupos.find((g) => g.tipo === 'ENTRADA')!.categorias[0]
    expect(categoria.lancamentos[0].conta).toBe('Caixa')
    expect(categoria.lancamentos[0].formaPagamento).toBe('Dinheiro')
  })

  it('ignora movimentação sem categoria vinculada', () => {
    const resultado = agruparMovimentacoesEmBalancete([mov({ categorias_movimentacao: null })])

    expect(resultado.totalEntradas).toBe(0)
    expect(resultado.totalSaidas).toBe(0)
  })
})

describe('balanceteParaResultado', () => {
  it('achata em uma linha de subtotal por categoria seguida das linhas de detalhe', () => {
    const balancete = agruparMovimentacoesEmBalancete([
      mov({ descricao: 'Pagamento João', valor: 100 }),
      mov({ descricao: 'Pagamento Maria', valor: 50 }),
    ])

    const resultado = balanceteParaResultado(balancete)

    expect(resultado.colunas).toEqual(['Categoria / Lançamento', 'Data', 'Conta', 'Forma', 'Valor'])
    // linha 0: cabeçalho do grupo "ENTRADAS"; linha 1: subtotal da categoria; linhas 2-3: detalhe
    expect(resultado.linhas[0][0]).toBe('ENTRADAS')
    expect(resultado.linhas[1][0]).toBe('Mensalidade (subtotal)')
    expect(resultado.linhas[1][4]).toBe('R$ 150,00')
    expect(resultado.linhas[2][0]).toBe('— Pagamento João')
    expect(resultado.linhas[3][0]).toBe('— Pagamento Maria')
  })

  it('inclui o resumo com entradas, saídas e saldo do período', () => {
    const balancete = agruparMovimentacoesEmBalancete([mov({ valor: 300 })])
    const resultado = balanceteParaResultado(balancete)

    expect(resultado.resumo).toEqual([
      { label: 'Entradas', valor: 'R$ 300,00' },
      { label: 'Saídas', valor: 'R$ 0,00' },
      { label: 'Saldo do período', valor: 'R$ 300,00' },
    ])
  })

  it('não gera nenhuma linha quando não há movimentações', () => {
    const resultado = balanceteParaResultado(agruparMovimentacoesEmBalancete([]))
    expect(resultado.linhas).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham (módulo ainda não existe)**

Run: `npx vitest run lib/relatorios/balancete.test.ts`
Expected: FAIL — `Cannot find module './balancete'` (ou equivalente).

- [ ] **Step 3: Implementar `lib/relatorios/balancete.ts`**

```ts
import type { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'
import type { ResultadoRelatorio } from './tipos'

export type FiltrosBalancete = {
  dataInicio?: string
  dataFim?: string
}

export type LancamentoBalancete = {
  data: string
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
  label: string
  total: number
  categorias: CategoriaBalancete[]
}

export type Balancete = {
  grupos: GrupoBalancete[]
  totalEntradas: number
  totalSaidas: number
  saldoPeriodo: number
}

type RelacaoCategoria = { id: string; nome: string; tipo: string }
type RelacaoNome = { nome: string }

export type MovimentacaoBrutaBalancete = {
  data: string
  descricao: string | null
  valor: number | string
  categorias_movimentacao: RelacaoCategoria[] | RelacaoCategoria | null
  contas: RelacaoNome[] | RelacaoNome | null
  formas_pagamento: RelacaoNome[] | RelacaoNome | null
}

function primeiro<T>(rel: T[] | T | null): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

const LABEL_GRUPO: Record<'ENTRADA' | 'SAIDA', string> = {
  ENTRADA: 'Entradas',
  SAIDA: 'Saídas',
}

/** Agrupa movimentações ATIVAS em um balancete por categoria, separado em Entradas e Saídas. Função pura — sem I/O. */
export function agruparMovimentacoesEmBalancete(movimentacoes: MovimentacaoBrutaBalancete[]): Balancete {
  const categoriasPorId = new Map<string, CategoriaBalancete & { tipo: 'ENTRADA' | 'SAIDA' }>()

  for (const mov of movimentacoes) {
    const categoria = primeiro(mov.categorias_movimentacao)
    if (!categoria) continue

    const tipo = categoria.tipo === 'SAIDA' ? 'SAIDA' : 'ENTRADA'
    const conta = primeiro(mov.contas)
    const forma = primeiro(mov.formas_pagamento)
    const valor = Number(mov.valor)

    let entry = categoriasPorId.get(categoria.id)
    if (!entry) {
      entry = { id: categoria.id, nome: categoria.nome, tipo, total: 0, lancamentos: [] }
      categoriasPorId.set(categoria.id, entry)
    }

    entry.total += valor
    entry.lancamentos.push({
      data: mov.data,
      descricao: mov.descricao ?? '-',
      conta: conta?.nome ?? '-',
      formaPagamento: forma?.nome ?? '-',
      valor,
    })
  }

  function montarGrupo(tipo: 'ENTRADA' | 'SAIDA'): GrupoBalancete {
    const categorias = [...categoriasPorId.values()]
      .filter((c) => c.tipo === tipo)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(({ id, nome, total, lancamentos }) => ({ id, nome, total, lancamentos }))
    const total = categorias.reduce((s, c) => s + c.total, 0)
    return { tipo, label: LABEL_GRUPO[tipo], total, categorias }
  }

  const grupoEntradas = montarGrupo('ENTRADA')
  const grupoSaidas = montarGrupo('SAIDA')

  return {
    grupos: [grupoEntradas, grupoSaidas],
    totalEntradas: grupoEntradas.total,
    totalSaidas: grupoSaidas.total,
    saldoPeriodo: grupoEntradas.total - grupoSaidas.total,
  }
}

export async function buscarBalancete(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filtros: FiltrosBalancete
): Promise<Balancete> {
  let query = supabase
    .from('movimentacoes')
    .select('data, descricao, valor, categorias_movimentacao(id, nome, tipo), contas(nome), formas_pagamento(nome)')
    .eq('status', 'ATIVO')
    .order('data', { ascending: true })

  if (filtros.dataInicio) query = query.gte('data', filtros.dataInicio)
  if (filtros.dataFim) query = query.lte('data', filtros.dataFim)

  const { data } = await query

  return agruparMovimentacoesEmBalancete((data ?? []) as unknown as MovimentacaoBrutaBalancete[])
}

/** Achata o balancete hierárquico em linhas para exportação PDF/CSV — cabeçalho de grupo, subtotal por categoria e linhas de detalhe de cada lançamento. */
export function balanceteParaResultado(balancete: Balancete): ResultadoRelatorio {
  const linhas: string[][] = []

  for (const grupo of balancete.grupos) {
    if (grupo.categorias.length === 0) continue

    linhas.push([grupo.label.toUpperCase(), '', '', '', ''])

    for (const categoria of grupo.categorias) {
      linhas.push([`${categoria.nome} (subtotal)`, '-', '-', '-', formatarMoedaBR(categoria.total)])
      for (const lanc of categoria.lancamentos) {
        linhas.push([`— ${lanc.descricao}`, formatarDataBR(lanc.data), lanc.conta, lanc.formaPagamento, formatarMoedaBR(lanc.valor)])
      }
    }
  }

  return {
    titulo: 'Balancete financeiro (analítico)',
    resumo: [
      { label: 'Entradas', valor: formatarMoedaBR(balancete.totalEntradas) },
      { label: 'Saídas', valor: formatarMoedaBR(balancete.totalSaidas) },
      { label: 'Saldo do período', valor: formatarMoedaBR(balancete.saldoPeriodo) },
    ],
    colunas: ['Categoria / Lançamento', 'Data', 'Conta', 'Forma', 'Valor'],
    linhas,
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run lib/relatorios/balancete.test.ts`
Expected: PASS (10 testes).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add lib/relatorios/balancete.ts lib/relatorios/balancete.test.ts
git commit -m "feat: agrupamento e achatamento do balancete financeiro por categoria"
```

---

### Task 2: Página e componente de tabela (accordion)

**Files:**
- Create: `app/(app)/relatorios/balancete/page.tsx`
- Create: `app/(app)/relatorios/balancete/BalanceteTable.tsx`

**Interfaces:**
- Consumes: `buscarBalancete`, `type FiltrosBalancete`, `type Balancete` de `lib/relatorios/balancete.ts` (Task 1); `paramsParaQueryString` de `lib/relatorios/query.ts`; `formatarDataBR`, `formatarMoedaBR` de `lib/format.ts`; `AcessoNegado` de `components/AcessoNegado.tsx`; `createSupabaseServerClient` de `lib/supabase/server.ts`.
- Produces: componente `BalanceteTable({ balancete: Balancete })`, página em `/relatorios/balancete`.

- [ ] **Step 1: Criar `app/(app)/relatorios/balancete/BalanceteTable.tsx`**

```tsx
'use client'

import { Fragment, useState } from 'react'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'
import type { Balancete } from '@/lib/relatorios/balancete'

export function BalanceteTable({ balancete }: { balancete: Balancete }) {
  const [expandido, setExpandido] = useState<string | null>(null)

  const temMovimentacao = balancete.grupos.some((g) => g.categorias.length > 0)

  if (!temMovimentacao) {
    return <p className="text-sm text-slate-500">Nenhuma movimentação encontrada para o período selecionado.</p>
  }

  return (
    <div className="space-y-6">
      {balancete.grupos.map((grupo) => {
        if (grupo.categorias.length === 0) return null

        return (
          <div key={grupo.tipo} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">{grupo.label}</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {grupo.categorias.map((categoria) => {
                  const chave = `${grupo.tipo}:${categoria.id}`
                  const aberto = expandido === chave
                  return (
                    <Fragment key={chave}>
                      <tr
                        onClick={() => setExpandido(aberto ? null : chave)}
                        className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                      >
                        <td className="px-4 py-2 font-medium text-slate-900">{categoria.nome}</td>
                        <td className="px-4 py-2 text-right">{formatarMoedaBR(categoria.total)}</td>
                      </tr>
                      {aberto && (
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <td colSpan={2} className="px-4 py-3">
                            <table className="w-full text-xs">
                              <thead className="text-left text-slate-500">
                                <tr>
                                  <th className="py-1 pr-4 font-medium">Data</th>
                                  <th className="py-1 pr-4 font-medium">Descrição</th>
                                  <th className="py-1 pr-4 font-medium">Conta</th>
                                  <th className="py-1 pr-4 font-medium">Forma</th>
                                  <th className="py-1 pr-4 text-right font-medium">Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {categoria.lancamentos.map((lanc, i) => (
                                  <tr key={i}>
                                    <td className="py-1 pr-4">{formatarDataBR(lanc.data)}</td>
                                    <td className="py-1 pr-4">{lanc.descricao}</td>
                                    <td className="py-1 pr-4">{lanc.conta}</td>
                                    <td className="py-1 pr-4">{lanc.formaPagamento}</td>
                                    <td className="py-1 pr-4 text-right">{formatarMoedaBR(lanc.valor)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                <tr className="bg-slate-100 font-semibold text-slate-900">
                  <td className="px-4 py-2">Subtotal {grupo.label.toLowerCase()}</td>
                  <td className="px-4 py-2 text-right">{formatarMoedaBR(grupo.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Criar `app/(app)/relatorios/balancete/page.tsx`**

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { buscarBalancete, type FiltrosBalancete } from '@/lib/relatorios/balancete'
import { paramsParaQueryString } from '@/lib/relatorios/query'
import { formatarMoedaBR } from '@/lib/format'
import { BalanceteTable } from './BalanceteTable'

export default async function RelatorioBalancetePage({
  searchParams,
}: {
  searchParams: Promise<FiltrosBalancete>
}) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const balancete = await buscarBalancete(supabase, params)
  const queryString = paramsParaQueryString(params)
  const sufixo = queryString ? `?${queryString}` : ''

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Balancete financeiro (analítico)</h1>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/relatorios/balancete/pdf${sufixo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            PDF
          </a>
          <a href={`/relatorios/balancete/csv${sufixo}`} className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
            Excel (CSV)
          </a>
        </div>
      </div>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">De</label>
          <input type="date" name="dataInicio" defaultValue={params.dataInicio} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Até</label>
          <input type="date" name="dataFim" defaultValue={params.dataFim} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-end">
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Filtrar
          </button>
        </div>
      </form>

      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Entradas</dt>
          <dd className="text-lg font-semibold text-slate-900">{formatarMoedaBR(balancete.totalEntradas)}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Saídas</dt>
          <dd className="text-lg font-semibold text-slate-900">{formatarMoedaBR(balancete.totalSaidas)}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Saldo do período</dt>
          <dd className="text-lg font-semibold text-slate-900">{formatarMoedaBR(balancete.saldoPeriodo)}</dd>
        </div>
      </dl>

      <BalanceteTable balancete={balancete} />
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/relatorios/balancete/page.tsx" "app/(app)/relatorios/balancete/BalanceteTable.tsx"
git commit -m "feat: pagina e tabela em accordion do balancete financeiro"
```

---

### Task 3: Exportação PDF e CSV

**Files:**
- Create: `app/(app)/relatorios/balancete/pdf/route.ts`
- Create: `app/(app)/relatorios/balancete/csv/route.ts`

**Interfaces:**
- Consumes: `buscarBalancete`, `balanceteParaResultado` de `lib/relatorios/balancete.ts` (Task 1); `gerarPdfTabela` de `lib/pdf/tabela.ts`; `buscarCabecalhoLoja` de `lib/pdf/cabecalho-loja.ts`; `gerarCsv` de `lib/csv.ts`.
- Produces: rotas `GET /relatorios/balancete/pdf` e `GET /relatorios/balancete/csv`.

- [ ] **Step 1: Criar `app/(app)/relatorios/balancete/pdf/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buscarBalancete, balanceteParaResultado } from '@/lib/relatorios/balancete'
import { gerarPdfTabela } from '@/lib/pdf/tabela'
import { buscarCabecalhoLoja } from '@/lib/pdf/cabecalho-loja'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const balancete = await buscarBalancete(supabase, {
    dataInicio: searchParams.get('dataInicio') ?? undefined,
    dataFim: searchParams.get('dataFim') ?? undefined,
  })
  const resultado = balanceteParaResultado(balancete)

  const cabecalho = await buscarCabecalhoLoja(supabase)
  const pdfBytes = await gerarPdfTabela({ ...resultado, lojaNome: cabecalho.nome, logo: cabecalho.logo })
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="balancete-financeiro.pdf"' },
  })
}
```

- [ ] **Step 2: Criar `app/(app)/relatorios/balancete/csv/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buscarBalancete, balanceteParaResultado } from '@/lib/relatorios/balancete'
import { gerarCsv } from '@/lib/csv'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const balancete = await buscarBalancete(supabase, {
    dataInicio: searchParams.get('dataInicio') ?? undefined,
    dataFim: searchParams.get('dataFim') ?? undefined,
  })
  const resultado = balanceteParaResultado(balancete)

  const csv = gerarCsv(resultado.colunas, resultado.linhas)
  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="balancete-financeiro.csv"' },
  })
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/relatorios/balancete/pdf/route.ts" "app/(app)/relatorios/balancete/csv/route.ts"
git commit -m "feat: exportacao PDF e CSV do balancete financeiro"
```

---

### Task 4: Navegação e verificação manual

**Files:**
- Modify: `app/(app)/relatorios/page.tsx`

**Interfaces:**
- Consumes: nada novo (só adiciona uma entrada de navegação).
- Produces: link "Balancete financeiro (analítico)" na tela `/relatorios`.

- [ ] **Step 1: Adicionar entrada na lista de relatórios**

Em `app/(app)/relatorios/page.tsx`, adicionar ao array `RELATORIOS` (após a entrada de "Movimentação de entradas e saídas"):

```ts
const RELATORIOS = [
  { titulo: 'Resumo de membros', href: '/relatorios/membros' },
  { titulo: 'Resumo geral de campanhas', href: '/relatorios/campanhas' },
  { titulo: 'Resumo de campanha específica', href: '/relatorios/campanhas?modo=especifica' },
  { titulo: 'Movimentação de entradas e saídas', href: '/relatorios/financeiro' },
  { titulo: 'Balancete financeiro (analítico)', href: '/relatorios/balancete' },
  { titulo: 'Relatório Grande Loja', href: '/relatorios/grande-loja' },
  { titulo: 'Saldos por conta', href: '/relatorios/saldos' },
  { titulo: 'Mensalidades / Inadimplência', href: '/relatorios/mensalidades' },
] as const
```

- [ ] **Step 2: Rodar toda a suíte de testes e o type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, sem erros de tipo.

- [ ] **Step 3: Verificação manual no navegador (dev server)**

1. Iniciar o dev server (`npm run dev` / preview do harness).
2. Logar no sistema e navegar até `/relatorios`.
3. Clicar em "Balancete financeiro (analítico)" e conferir:
   - Seções "Entradas" e "Saídas" aparecem com subtotal por categoria e subtotal do grupo.
   - Clicar em uma categoria expande a lista de lançamentos (data em `DD/MM/AAAA`, valores em `R$ 0.000,00`).
   - Clicar de novo recolhe; abrir outra categoria fecha a anterior.
   - Cards de resumo (Entradas, Saídas, Saldo do período) batem com os subtotais das seções.
   - Aplicar filtro de período (De/Até) e conferir que a lista e os totais mudam de acordo.
   - Botões "PDF" e "Excel (CSV)" baixam/abrem o arquivo com o balancete achatado (cabeçalho de grupo, subtotal por categoria, linhas de detalhe).
4. Reportar qualquer divergência encontrada antes de considerar a task concluída.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/relatorios/page.tsx"
git commit -m "feat: adiciona balancete financeiro a navegacao de relatorios"
```
