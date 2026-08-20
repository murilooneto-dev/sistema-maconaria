# Relatório por Centro de Custo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um relatório dedicado em `/relatorios/centros-de-custo`, com exportação PDF/CSV, detalhando entradas/saídas por centro de custo → categoria → lançamento, reaproveitando os dados já calculados por `buscarDadosCentrosDeCusto` (feature de centros de custo já em produção).

**Architecture:** Um novo módulo puro `lib/relatorios/centros-de-custo-relatorio.ts` (testado com vitest, sem I/O) filtra e reagrupa o resultado de `buscarDadosCentrosDeCusto` em uma estrutura de 3 níveis pronta para tela e exportação — mesmo padrão de `lib/relatorios/balancete.ts` (agrupar → `...paraResultado`). Nenhuma alteração é feita em `lib/relatorios/centros-de-custo.ts` (já revisado e em produção), zero risco de regressão no dashboard "Visão geral" de `/financeiro`.

**Tech Stack:** Next.js (App Router, Route Handlers), TypeScript, Supabase, Tailwind CSS, vitest, pdf-lib (via `lib/pdf/tabela.ts` já existente).

## Global Constraints

- Especificação oficial: `docs/superpowers/specs/2026-08-20-relatorio-centros-de-custo-design.md`.
- **Não alterar `lib/relatorios/centros-de-custo.ts`** — é a fonte de dados já testada e em produção; qualquer necessidade nova é resolvida em cima dela, num arquivo separado.
- Acesso ao relatório: qualquer usuário autenticado (somente leitura), sem exigência de role — mesmo padrão de `/relatorios/balancete`.
- Dinheiro tratado como `number` já convertido (a fonte `CentroDeCustoResumo` já entrega valores numéricos prontos — nenhuma conversão de string/numeric aqui).
- Categoria pode pertencer a mais de um centro de custo (decisão já tomada na feature anterior) — a tela deve deixar isso explícito ao usuário via nota informativa; nenhuma tentativa de reconciliar/alertar sobre a sobreposição além do texto informativo.
- TypeScript estrito, sem dependência nova (reaproveita `pdf-lib`/`gerarPdfTabela`/`gerarCsv` já existentes).

---

### Task 1: Módulo de relatório — funções puras + testes

**Files:**
- Create: `lib/relatorios/centros-de-custo-relatorio.ts`
- Test: `lib/relatorios/centros-de-custo-relatorio.test.ts`

**Interfaces:**
- Consumes: `CentroDeCustoResumo`, `MovimentacaoCentro` (tipos, de `@/lib/relatorios/centros-de-custo`) — apenas leitura, nenhuma modificação nesse arquivo.
- Produces (usados pelas Tasks 2 e 3):
  - `function filtrarCentroDeCusto(centros: CentroDeCustoResumo[], centroDeCustoId?: string): CentroDeCustoResumo[]`
  - `type LancamentoCentroDetalhado = { data: string; descricao: string; valor: number }`
  - `type CategoriaCentroDetalhada = { nome: string; tipo: 'ENTRADA' | 'SAIDA'; total: number; lancamentos: LancamentoCentroDetalhado[] }`
  - `type CentroDeCustoDetalhado = { id: string; nome: string; cor: string; totalEntradas: number; totalSaidas: number; saldo: number; categorias: CategoriaCentroDetalhada[] }`
  - `function detalharCentrosDeCusto(centros: CentroDeCustoResumo[]): CentroDeCustoDetalhado[]`
  - `function centrosDeCustoParaResultado(centros: CentroDeCustoDetalhado[]): ResultadoRelatorio` (tipo `ResultadoRelatorio` de `@/lib/relatorios/tipos`, já existente: `{ titulo, subtitulo?, resumo?, colunas, linhas }`)

- [ ] **Step 1: Escrever os testes**

```typescript
// lib/relatorios/centros-de-custo-relatorio.test.ts
import { describe, expect, it } from 'vitest'
import type { CentroDeCustoResumo } from './centros-de-custo'
import { formatarMoedaBR } from '@/lib/format'
import {
  filtrarCentroDeCusto,
  detalharCentrosDeCusto,
  centrosDeCustoParaResultado,
} from './centros-de-custo-relatorio'

function centro(overrides: Partial<CentroDeCustoResumo> = {}): CentroDeCustoResumo {
  return {
    id: 'centro-1',
    nome: 'Administrativo',
    cor: '#000000',
    totalEntradas: 0,
    totalSaidas: 0,
    saldo: 0,
    porCategoria: [],
    movimentacoes: [],
    ...overrides,
  }
}

describe('filtrarCentroDeCusto', () => {
  it('sem centroDeCustoId retorna todos os centros', () => {
    const centros = [centro({ id: 'a' }), centro({ id: 'b' })]
    expect(filtrarCentroDeCusto(centros, undefined)).toEqual(centros)
  })

  it('com string vazia retorna todos os centros', () => {
    const centros = [centro({ id: 'a' }), centro({ id: 'b' })]
    expect(filtrarCentroDeCusto(centros, '')).toEqual(centros)
  })

  it('com um id existente retorna só aquele centro', () => {
    const centros = [centro({ id: 'a' }), centro({ id: 'b' })]
    const resultado = filtrarCentroDeCusto(centros, 'b')
    expect(resultado).toHaveLength(1)
    expect(resultado[0].id).toBe('b')
  })

  it('com id inexistente retorna array vazio', () => {
    const centros = [centro({ id: 'a' })]
    expect(filtrarCentroDeCusto(centros, 'nao-existe')).toEqual([])
  })

  it('com SEM_CENTRO_ID retorna só a pseudo-categoria "Sem centro de custo"', () => {
    const centros = [centro({ id: 'a' }), centro({ id: 'sem-centro', nome: 'Sem centro de custo' })]
    const resultado = filtrarCentroDeCusto(centros, 'sem-centro')
    expect(resultado).toHaveLength(1)
    expect(resultado[0].id).toBe('sem-centro')
  })
})

describe('detalharCentrosDeCusto', () => {
  it('agrupa lançamentos de um centro por nome de categoria e soma o total', () => {
    const centros = [
      centro({
        movimentacoes: [
          { id: 'm1', data: '2026-08-10', categoria: 'Mensalidade', descricao: 'Pag 1', valor: 100, tipo: 'ENTRADA' },
          { id: 'm2', data: '2026-08-11', categoria: 'Mensalidade', descricao: 'Pag 2', valor: 50, tipo: 'ENTRADA' },
          { id: 'm3', data: '2026-08-12', categoria: 'Tronco', descricao: 'Doação', valor: 30, tipo: 'ENTRADA' },
        ],
      }),
    ]

    const [detalhado] = detalharCentrosDeCusto(centros)

    expect(detalhado.categorias).toHaveLength(2)
    const mensalidade = detalhado.categorias.find((c) => c.nome === 'Mensalidade')!
    expect(mensalidade.total).toBe(150)
    expect(mensalidade.lancamentos).toHaveLength(2)
    const tronco = detalhado.categorias.find((c) => c.nome === 'Tronco')!
    expect(tronco.total).toBe(30)
    expect(tronco.lancamentos).toHaveLength(1)
  })

  it('centro sem movimentações produz categorias vazias', () => {
    const centros = [centro({ movimentacoes: [] })]
    const [detalhado] = detalharCentrosDeCusto(centros)
    expect(detalhado.categorias).toEqual([])
  })

  it('preserva identidade e totais do centro (id, nome, cor, totalEntradas, totalSaidas, saldo)', () => {
    const centros = [
      centro({
        id: 'centro-x',
        nome: 'Eventos',
        cor: '#123456',
        totalEntradas: 200,
        totalSaidas: 80,
        saldo: 120,
        movimentacoes: [
          { id: 'm1', data: '2026-08-10', categoria: 'Ingressos', descricao: 'Venda', valor: 200, tipo: 'ENTRADA' },
          { id: 'm2', data: '2026-08-11', categoria: 'Aluguel de espaço', descricao: 'Salão', valor: 80, tipo: 'SAIDA' },
        ],
      }),
    ]

    const [detalhado] = detalharCentrosDeCusto(centros)

    expect(detalhado.id).toBe('centro-x')
    expect(detalhado.nome).toBe('Eventos')
    expect(detalhado.cor).toBe('#123456')
    expect(detalhado.totalEntradas).toBe(200)
    expect(detalhado.totalSaidas).toBe(80)
    expect(detalhado.saldo).toBe(120)
  })

  it('ordena categorias por total decrescente', () => {
    const centros = [
      centro({
        movimentacoes: [
          { id: 'm1', data: '2026-08-10', categoria: 'Pequena', descricao: 'A', valor: 10, tipo: 'ENTRADA' },
          { id: 'm2', data: '2026-08-11', categoria: 'Grande', descricao: 'B', valor: 500, tipo: 'ENTRADA' },
        ],
      }),
    ]

    const [detalhado] = detalharCentrosDeCusto(centros)
    expect(detalhado.categorias.map((c) => c.nome)).toEqual(['Grande', 'Pequena'])
  })

  it('ordena lançamentos dentro da categoria por data decrescente', () => {
    const centros = [
      centro({
        movimentacoes: [
          { id: 'm1', data: '2026-08-01', categoria: 'Mensalidade', descricao: 'Antigo', valor: 10, tipo: 'ENTRADA' },
          { id: 'm2', data: '2026-08-20', categoria: 'Mensalidade', descricao: 'Recente', valor: 10, tipo: 'ENTRADA' },
        ],
      }),
    ]

    const [detalhado] = detalharCentrosDeCusto(centros)
    expect(detalhado.categorias[0].lancamentos.map((l) => l.descricao)).toEqual(['Recente', 'Antigo'])
  })
})

describe('centrosDeCustoParaResultado', () => {
  it('gera título e colunas fixas do relatório', () => {
    const resultado = centrosDeCustoParaResultado([])
    expect(resultado.titulo).toBe('Relatório por centro de custo')
    expect(resultado.colunas).toEqual(['Centro / Categoria / Lançamento', 'Data', 'Valor'])
  })

  it('gera cabeçalho por centro, subtotal por categoria e linha por lançamento', () => {
    const centros = [
      centro({
        id: 'centro-1',
        nome: 'Administrativo',
        totalEntradas: 100,
        totalSaidas: 0,
        saldo: 100,
        movimentacoes: [
          { id: 'm1', data: '2026-08-10', categoria: 'Mensalidade', descricao: 'Pag 1', valor: 100, tipo: 'ENTRADA' },
        ],
      }),
    ]

    const resultado = centrosDeCustoParaResultado(detalharCentrosDeCusto(centros))

    expect(resultado.linhas[0][0]).toContain('ADMINISTRATIVO')
    expect(resultado.linhas.some((l) => l[0].includes('Mensalidade (subtotal)'))).toBe(true)
    expect(resultado.linhas.some((l) => l[0].includes('— Pag 1'))).toBe(true)
    const linhaLancamento = resultado.linhas.find((l) => l[0].includes('— Pag 1'))!
    expect(linhaLancamento[1]).toBe('10/08/2026')
    expect(linhaLancamento[2]).toBe(formatarMoedaBR(100))
  })

  it('não inclui centro sem nenhuma movimentação no período', () => {
    const centros = [centro({ id: 'vazio', nome: 'Vazio', movimentacoes: [] })]
    const resultado = centrosDeCustoParaResultado(detalharCentrosDeCusto(centros))
    expect(resultado.linhas).toEqual([])
  })

  it('soma entradas e saídas de todos os centros no resumo', () => {
    const centros = [
      centro({
        id: 'a',
        totalEntradas: 100,
        totalSaidas: 20,
        saldo: 80,
        movimentacoes: [{ id: 'm1', data: '2026-08-10', categoria: 'Cat A', descricao: 'X', valor: 100, tipo: 'ENTRADA' }],
      }),
      centro({
        id: 'b',
        totalEntradas: 0,
        totalSaidas: 30,
        saldo: -30,
        movimentacoes: [{ id: 'm2', data: '2026-08-11', categoria: 'Cat B', descricao: 'Y', valor: 30, tipo: 'SAIDA' }],
      }),
    ]

    const resultado = centrosDeCustoParaResultado(detalharCentrosDeCusto(centros))

    expect(resultado.resumo).toEqual([
      { label: 'Entradas', valor: formatarMoedaBR(100) },
      { label: 'Saídas', valor: formatarMoedaBR(50) },
      { label: 'Saldo do período', valor: formatarMoedaBR(50) },
    ])
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run lib/relatorios/centros-de-custo-relatorio.test.ts`
Expected: FAIL — `Cannot find module './centros-de-custo-relatorio'`.

- [ ] **Step 3: Implementar `lib/relatorios/centros-de-custo-relatorio.ts`**

```typescript
import type { CentroDeCustoResumo } from './centros-de-custo'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'
import type { ResultadoRelatorio } from './tipos'

/** Restringe o resultado de buscarDadosCentrosDeCusto a um único centro (ou nenhum filtro). Função pura — sem I/O. */
export function filtrarCentroDeCusto(
  centros: CentroDeCustoResumo[],
  centroDeCustoId?: string
): CentroDeCustoResumo[] {
  if (!centroDeCustoId) return centros
  return centros.filter((c) => c.id === centroDeCustoId)
}

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

/** Reagrupa as movimentações (já achatadas) de cada centro por nome de categoria, para exibição em 3 níveis. Função pura — sem I/O. */
export function detalharCentrosDeCusto(centros: CentroDeCustoResumo[]): CentroDeCustoDetalhado[] {
  return centros.map((centro) => {
    const porCategoria = new Map<string, CategoriaCentroDetalhada>()

    for (const mov of centro.movimentacoes) {
      let entry = porCategoria.get(mov.categoria)
      if (!entry) {
        entry = { nome: mov.categoria, tipo: mov.tipo, total: 0, lancamentos: [] }
        porCategoria.set(mov.categoria, entry)
      }
      entry.total += mov.valor
      entry.lancamentos.push({ data: mov.data, descricao: mov.descricao, valor: mov.valor })
    }

    const categorias = [...porCategoria.values()]
      .sort((a, b) => b.total - a.total)
      .map((c) => ({ ...c, lancamentos: [...c.lancamentos].sort((a, b) => (a.data < b.data ? 1 : -1)) }))

    return {
      id: centro.id,
      nome: centro.nome,
      cor: centro.cor,
      totalEntradas: centro.totalEntradas,
      totalSaidas: centro.totalSaidas,
      saldo: centro.saldo,
      categorias,
    }
  })
}

/** Achata os centros detalhados em linhas para exportação PDF/CSV — cabeçalho de centro, subtotal por categoria e linha de detalhe de cada lançamento. */
export function centrosDeCustoParaResultado(centros: CentroDeCustoDetalhado[]): ResultadoRelatorio {
  const linhas: string[][] = []

  for (const centro of centros) {
    if (centro.categorias.length === 0) continue

    linhas.push([`CENTRO: ${centro.nome.toUpperCase()}`, '', formatarMoedaBR(centro.saldo)])

    for (const categoria of centro.categorias) {
      linhas.push([`${categoria.nome} (subtotal)`, '-', formatarMoedaBR(categoria.total)])
      for (const lanc of categoria.lancamentos) {
        linhas.push([`— ${lanc.descricao}`, formatarDataBR(lanc.data), formatarMoedaBR(lanc.valor)])
      }
    }
  }

  const totalEntradas = centros.reduce((s, c) => s + c.totalEntradas, 0)
  const totalSaidas = centros.reduce((s, c) => s + c.totalSaidas, 0)

  return {
    titulo: 'Relatório por centro de custo',
    resumo: [
      { label: 'Entradas', valor: formatarMoedaBR(totalEntradas) },
      { label: 'Saídas', valor: formatarMoedaBR(totalSaidas) },
      { label: 'Saldo do período', valor: formatarMoedaBR(totalEntradas - totalSaidas) },
    ],
    colunas: ['Centro / Categoria / Lançamento', 'Data', 'Valor'],
    linhas,
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run lib/relatorios/centros-de-custo-relatorio.test.ts`
Expected: PASS — todos os testes passando.

- [ ] **Step 5: Commit**

```bash
git add lib/relatorios/centros-de-custo-relatorio.ts lib/relatorios/centros-de-custo-relatorio.test.ts
git commit -m "feat: adiciona logica de relatorio por centro de custo"
```

---

### Task 2: Tela do relatório — filtros, cards de totais e tabela de 3 níveis

**Files:**
- Create: `app/(app)/relatorios/centros-de-custo/page.tsx`
- Create: `app/(app)/relatorios/centros-de-custo/CentrosDeCustoRelatorioTable.tsx`
- Modify: `app/(app)/relatorios/page.tsx`

**Interfaces:**
- Consumes: `buscarDadosCentrosDeCusto`, `SEM_CENTRO_ID` de `@/lib/relatorios/centros-de-custo` (já existente); `filtrarCentroDeCusto`, `detalharCentrosDeCusto`, `type CentroDeCustoDetalhado` de `@/lib/relatorios/centros-de-custo-relatorio` (Task 1); `paramsParaQueryString` de `@/lib/relatorios/query` (já existente); `formatarMoedaBR`, `formatarDataBR` de `@/lib/format`; `AcessoNegado` de `@/components/AcessoNegado`.

- [ ] **Step 1: Criar a tabela de 3 níveis (client component)**

```tsx
// app/(app)/relatorios/centros-de-custo/CentrosDeCustoRelatorioTable.tsx
'use client'

import { Fragment, useState } from 'react'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'
import type { CentroDeCustoDetalhado } from '@/lib/relatorios/centros-de-custo-relatorio'

export function CentrosDeCustoRelatorioTable({ centros }: { centros: CentroDeCustoDetalhado[] }) {
  const [centroAberto, setCentroAberto] = useState<string | null>(null)
  const [categoriaAberta, setCategoriaAberta] = useState<string | null>(null)

  const centrosComMovimentacao = centros.filter((c) => c.categorias.length > 0)

  if (centrosComMovimentacao.length === 0) {
    return <p className="text-sm text-slate-500">Nenhuma movimentação encontrada para o período selecionado.</p>
  }

  return (
    <div className="space-y-4">
      {centrosComMovimentacao.map((centro) => {
        const aberto = centroAberto === centro.id
        return (
          <div key={centro.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setCentroAberto(aberto ? null : centro.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
            >
              <span className="flex items-center gap-2 font-medium text-slate-900">
                <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: centro.cor }} />
                {centro.nome}
              </span>
              <span className="flex gap-4 text-sm">
                <span className="text-green-700">{formatarMoedaBR(centro.totalEntradas)}</span>
                <span className="text-red-700">{formatarMoedaBR(centro.totalSaidas)}</span>
                <span className="font-semibold text-slate-900">{formatarMoedaBR(centro.saldo)}</span>
              </span>
            </button>

            {aberto && (
              <table className="w-full border-t border-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Categoria</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {centro.categorias.map((categoria) => {
                    const chave = `${centro.id}:${categoria.nome}`
                    const categoriaAbertaAqui = categoriaAberta === chave
                    return (
                      <Fragment key={chave}>
                        <tr
                          onClick={() => setCategoriaAberta(categoriaAbertaAqui ? null : chave)}
                          className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                        >
                          <td className="px-4 py-2 text-slate-900">{categoria.nome}</td>
                          <td className="px-4 py-2 text-right">{formatarMoedaBR(categoria.total)}</td>
                        </tr>
                        {categoriaAbertaAqui && (
                          <tr className="border-b border-slate-100 bg-slate-50">
                            <td colSpan={2} className="px-4 py-3">
                              <table className="w-full text-xs">
                                <thead className="text-left text-slate-500">
                                  <tr>
                                    <th className="py-1 pr-4 font-medium">Data</th>
                                    <th className="py-1 pr-4 font-medium">Descrição</th>
                                    <th className="py-1 pr-4 text-right font-medium">Valor</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {categoria.lancamentos.map((lanc, i) => (
                                    <tr key={i}>
                                      <td className="py-1 pr-4">{formatarDataBR(lanc.data)}</td>
                                      <td className="py-1 pr-4">{lanc.descricao}</td>
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
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Criar a página**

```tsx
// app/(app)/relatorios/centros-de-custo/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { buscarDadosCentrosDeCusto, SEM_CENTRO_ID } from '@/lib/relatorios/centros-de-custo'
import { filtrarCentroDeCusto, detalharCentrosDeCusto } from '@/lib/relatorios/centros-de-custo-relatorio'
import { paramsParaQueryString } from '@/lib/relatorios/query'
import { formatarMoedaBR } from '@/lib/format'
import { CentrosDeCustoRelatorioTable } from './CentrosDeCustoRelatorioTable'

type SearchParams = { dataInicio?: string; dataFim?: string; centroDeCustoId?: string }

export default async function RelatorioCentrosDeCustoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: centrosAtivos } = await supabase
    .from('centros_de_custo')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')

  const dados = await buscarDadosCentrosDeCusto(supabase, {
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
  })
  const filtrados = filtrarCentroDeCusto(dados, params.centroDeCustoId)
  const detalhados = detalharCentrosDeCusto(filtrados)

  const totalEntradas = detalhados.reduce((s, c) => s + c.totalEntradas, 0)
  const totalSaidas = detalhados.reduce((s, c) => s + c.totalSaidas, 0)

  const queryString = paramsParaQueryString(params)
  const sufixo = queryString ? `?${queryString}` : ''

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Relatório por centro de custo</h1>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/relatorios/centros-de-custo/pdf${sufixo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            PDF
          </a>
          <a
            href={`/relatorios/centros-de-custo/csv${sufixo}`}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            Excel (CSV)
          </a>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Uma categoria pode pertencer a mais de um centro de custo. Quando isso ocorre, a movimentação aparece em
        todos os centros vinculados, e a soma dos centros pode ultrapassar o total geral do período.
      </p>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">De</label>
          <input type="date" name="dataInicio" defaultValue={params.dataInicio} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Até</label>
          <input type="date" name="dataFim" defaultValue={params.dataFim} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Centro de custo</label>
          <select
            name="centroDeCustoId"
            defaultValue={params.centroDeCustoId ?? ''}
            className="w-full rounded border border-slate-300 px-2 py-1"
          >
            <option value="">Todos</option>
            {(centrosAtivos ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
            <option value={SEM_CENTRO_ID}>Sem centro de custo</option>
          </select>
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
          <dd className="text-lg font-semibold text-green-700">{formatarMoedaBR(totalEntradas)}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Saídas</dt>
          <dd className="text-lg font-semibold text-red-700">{formatarMoedaBR(totalSaidas)}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Saldo do período</dt>
          <dd className="text-lg font-semibold text-slate-900">{formatarMoedaBR(totalEntradas - totalSaidas)}</dd>
        </div>
      </dl>

      <CentrosDeCustoRelatorioTable centros={detalhados} />
    </div>
  )
}
```

- [ ] **Step 3: Adicionar o link em Relatórios**

Em `app/(app)/relatorios/page.tsx`, adicionar ao array `RELATORIOS` (logo após a entrada `'Balancete financeiro (analítico)'`):

```typescript
  { titulo: 'Relatório por centro de custo', href: '/relatorios/centros-de-custo' },
```

- [ ] **Step 4: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos originados por estes arquivos (os routes de PDF/CSV ainda não existem — isso é esperado até a Task 3, `tsc --noEmit` não depende de rotas do Next existirem).

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/relatorios/centros-de-custo/page.tsx" "app/(app)/relatorios/centros-de-custo/CentrosDeCustoRelatorioTable.tsx" "app/(app)/relatorios/page.tsx"
git commit -m "feat: adiciona tela do relatorio por centro de custo"
```

---

### Task 3: Exportação PDF e CSV

**Files:**
- Create: `app/(app)/relatorios/centros-de-custo/pdf/route.ts`
- Create: `app/(app)/relatorios/centros-de-custo/csv/route.ts`

**Interfaces:**
- Consumes: `buscarDadosCentrosDeCusto` de `@/lib/relatorios/centros-de-custo`; `filtrarCentroDeCusto`, `detalharCentrosDeCusto`, `centrosDeCustoParaResultado` de `@/lib/relatorios/centros-de-custo-relatorio` (Task 1); `gerarPdfTabela` de `@/lib/pdf/tabela`; `buscarCabecalhoLoja` de `@/lib/pdf/cabecalho-loja`; `gerarCsv` de `@/lib/csv`.

- [ ] **Step 1: Criar a rota de PDF**

```typescript
// app/(app)/relatorios/centros-de-custo/pdf/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buscarDadosCentrosDeCusto } from '@/lib/relatorios/centros-de-custo'
import {
  filtrarCentroDeCusto,
  detalharCentrosDeCusto,
  centrosDeCustoParaResultado,
} from '@/lib/relatorios/centros-de-custo-relatorio'
import { gerarPdfTabela } from '@/lib/pdf/tabela'
import { buscarCabecalhoLoja } from '@/lib/pdf/cabecalho-loja'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dados = await buscarDadosCentrosDeCusto(supabase, {
    dataInicio: searchParams.get('dataInicio') ?? undefined,
    dataFim: searchParams.get('dataFim') ?? undefined,
  })
  const filtrados = filtrarCentroDeCusto(dados, searchParams.get('centroDeCustoId') ?? undefined)
  const resultado = centrosDeCustoParaResultado(detalharCentrosDeCusto(filtrados))

  const cabecalho = await buscarCabecalhoLoja(supabase)
  const pdfBytes = await gerarPdfTabela({ ...resultado, lojaNome: cabecalho.nome, logo: cabecalho.logo })
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="relatorio-centros-de-custo.pdf"',
    },
  })
}
```

- [ ] **Step 2: Criar a rota de CSV**

```typescript
// app/(app)/relatorios/centros-de-custo/csv/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buscarDadosCentrosDeCusto } from '@/lib/relatorios/centros-de-custo'
import {
  filtrarCentroDeCusto,
  detalharCentrosDeCusto,
  centrosDeCustoParaResultado,
} from '@/lib/relatorios/centros-de-custo-relatorio'
import { gerarCsv } from '@/lib/csv'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dados = await buscarDadosCentrosDeCusto(supabase, {
    dataInicio: searchParams.get('dataInicio') ?? undefined,
    dataFim: searchParams.get('dataFim') ?? undefined,
  })
  const filtrados = filtrarCentroDeCusto(dados, searchParams.get('centroDeCustoId') ?? undefined)
  const resultado = centrosDeCustoParaResultado(detalharCentrosDeCusto(filtrados))

  const csv = gerarCsv(resultado.colunas, resultado.linhas)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="relatorio-centros-de-custo.csv"',
    },
  })
}
```

- [ ] **Step 3: Checar tipos e rodar toda a suíte de testes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros de tipo; todos os testes (existentes + novos de `centros-de-custo-relatorio.test.ts`) passando.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/relatorios/centros-de-custo/pdf/route.ts" "app/(app)/relatorios/centros-de-custo/csv/route.ts"
git commit -m "feat: adiciona exportacao pdf e csv do relatorio por centro de custo"
```

---

### Task 4: Verificação manual no navegador

**Files:** nenhum (só validação)

- [ ] **Step 1: Subir o servidor de desenvolvimento e abrir `/relatorios`**

Confirmar que o card "Relatório por centro de custo" aparece na lista, na posição esperada.

- [ ] **Step 2: Abrir `/relatorios/centros-de-custo`**

Com pelo menos dois centros de custo cadastrados (um deles com uma categoria compartilhada com outro, e alguma categoria sem nenhum centro vinculado) e movimentações no período:

- Confirmar que os cards de totais (Entradas/Saídas/Saldo) aparecem corretos.
- Confirmar que a nota sobre sobreposição de centros está visível.
- Expandir um centro → expandir uma categoria → confirmar que os lançamentos individuais aparecem com data, descrição e valor corretos.
- Selecionar um centro específico no filtro e confirmar que só aquele centro aparece.
- Selecionar "Sem centro de custo" e confirmar que mostra as categorias não vinculadas a nenhum centro.
- Mudar o período (De/Até) e confirmar que os totais mudam de acordo.

- [ ] **Step 3: Testar a exportação**

Clicar em "PDF" e confirmar que abre um PDF com cabeçalho da Loja, título, resumo e a tabela hierárquica (centro → categoria (subtotal) → lançamento). Clicar em "Excel (CSV)" e confirmar que baixa um CSV abrindo corretamente no Excel/LibreOffice (separador `;`, acentuação correta).

- [ ] **Step 4: Rodar a suíte completa de testes e o build de produção**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: tudo verde, sem erros de tipo ou de build.
