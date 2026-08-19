# Dashboard de Centros de Custo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar centros de custo (agrupamento de categorias definido em Configurações) e reorganizar a tela Financeiro para abrir numa "Visão geral" com cards por centro de custo, movendo a tabela atual de movimentações para uma aba própria.

**Architecture:** Nova tabela `centros_de_custo` + junção N:N `centros_de_custo_categorias`. Uma função pura de agrupamento (`agruparMovimentacoesPorCentroDeCusto`, testada com vitest) recebe as movimentações do período já buscadas e distribui os totais por centro, incluindo um pseudo-centro "Sem centro de custo". A tela Financeiro ganha uma nova aba padrão ("Visão geral") que roda essa função server-side e passa o resultado pronto para um client component que renderiza os cards e o modal de detalhe — sem chamadas de API adicionais no clique.

**Tech Stack:** Next.js (App Router, Server Actions), TypeScript, Supabase/PostgreSQL, Tailwind CSS, vitest. SVG puro para gráficos (sem lib nova), seguindo `app/(app)/dashboard/GraficoEntradasSaidas.tsx`.

## Global Constraints

- Especificação oficial: `docs/superpowers/specs/2026-08-19-dashboard-centros-de-custo-design.md`. Qualquer dúvida que altere regra financeira/rastreabilidade deve parar e perguntar (CLAUDE.md §1, §4).
- Movimentações financeiras nunca são apagadas fisicamente — este trabalho não toca nessa regra, é só apresentação (CLAUDE.md §8).
- Toda escrita em `centros_de_custo*` é restrita a ADMINISTRADOR, validada server-side via `requireAdmin()`, nunca só na UI (CLAUDE.md §10, §11).
- Ações críticas (criar/editar centro, alterar categorias do centro) geram auditoria via `registrarAuditoria` (CLAUDE.md §12).
- TypeScript estrito, componentes pequenos, sem dependência nova de gráficos (CLAUDE.md §17, e decisão da spec).
- Dinheiro em `numeric`, nunca alterar valores históricos — não aplicável aqui pois não há gravação de valores financeiros novos, só leitura/agrupamento.

---

### Task 1: Migration — tabelas `centros_de_custo` e `centros_de_custo_categorias`

**Files:**
- Create: `supabase/migrations/00000000000029_centros_de_custo.sql`

**Interfaces:**
- Produces: tabelas `public.centros_de_custo (id, nome, cor, ativo, created_at, updated_at)` e `public.centros_de_custo_categorias (centro_de_custo_id, categoria_id)`, usadas por todas as tasks seguintes.

- [ ] **Step 1: Escrever a migration**

```sql
-- Centros de custo: agrupamento de categorias de movimentação definido pelo
-- usuário em Configurações, usado para organizar o dashboard financeiro
-- ("Visão geral" da tela Financeiro) por área/finalidade em vez de por
-- categoria crua. Ver docs/superpowers/specs/2026-08-19-dashboard-centros-de-custo-design.md.

create table public.centros_de_custo (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cor text not null default '#64748b',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.centros_de_custo enable row level security;

create policy "centros_de_custo_select_authenticated"
  on public.centros_de_custo for select to authenticated using (true);

create policy "centros_de_custo_write_admin"
  on public.centros_de_custo for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create trigger centros_de_custo_set_updated_at
  before update on public.centros_de_custo
  for each row execute function public.set_updated_at();

-- Vínculo N:N: uma categoria pode pertencer a mais de um centro de custo
-- (decisão de produto — os totais dos cards podem então se sobrepor quando
-- houver categorias compartilhadas entre centros; comportamento intencional).
create table public.centros_de_custo_categorias (
  centro_de_custo_id uuid not null references public.centros_de_custo(id) on delete cascade,
  categoria_id uuid not null references public.categorias_movimentacao(id) on delete cascade,
  primary key (centro_de_custo_id, categoria_id)
);

create index centros_de_custo_categorias_categoria_idx on public.centros_de_custo_categorias (categoria_id);

alter table public.centros_de_custo_categorias enable row level security;

create policy "centros_de_custo_categorias_select_authenticated"
  on public.centros_de_custo_categorias for select to authenticated using (true);

create policy "centros_de_custo_categorias_write_admin"
  on public.centros_de_custo_categorias for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 2: Aplicar a migration localmente**

Run: `supabase db push` (fluxo já usado no projeto — ver `docs/banco.md` §"Convenções de migration")
Expected: migration `00000000000029_centros_de_custo.sql` aplicada sem erro; tabelas `centros_de_custo` e `centros_de_custo_categorias` visíveis no schema.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00000000000029_centros_de_custo.sql
git commit -m "feat: adiciona tabelas de centros de custo"
```

---

### Task 2: Lógica de agrupamento por centro de custo (função pura + busca)

**Files:**
- Create: `lib/relatorios/centros-de-custo.ts`
- Test: `lib/relatorios/centros-de-custo.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores (só a tabela criada na Task 1, para a função de busca).
- Produces (usados pelas Tasks 6/7):
  - `type CentroDeCustoInput = { id: string; nome: string; cor: string }`
  - `type VinculoCentroCategoria = { centroDeCustoId: string; categoriaId: string }`
  - `type MovimentacaoBrutaCentro = { id: string; data: string; descricao: string | null; valor: number | string; tipo: 'ENTRADA' | 'SAIDA'; categorias_movimentacao: { id: string; nome: string }[] | { id: string; nome: string } | null }`
  - `type MovimentacaoCentro = { id: string; data: string; categoria: string; descricao: string; valor: number; tipo: 'ENTRADA' | 'SAIDA' }`
  - `type CategoriaResumoCentro = { categoriaId: string; nome: string; tipo: 'ENTRADA' | 'SAIDA'; valor: number }`
  - `type CentroDeCustoResumo = { id: string; nome: string; cor: string; totalEntradas: number; totalSaidas: number; saldo: number; porCategoria: CategoriaResumoCentro[]; movimentacoes: MovimentacaoCentro[] }`
  - `const SEM_CENTRO_ID = 'sem-centro'`
  - `function agruparMovimentacoesPorCentroDeCusto(movimentacoes: MovimentacaoBrutaCentro[], centros: CentroDeCustoInput[], vinculos: VinculoCentroCategoria[]): CentroDeCustoResumo[]`
  - `type FiltrosCentrosDeCusto = { dataInicio?: string; dataFim?: string }`
  - `async function buscarDadosCentrosDeCusto(supabase, filtros: FiltrosCentrosDeCusto): Promise<CentroDeCustoResumo[]>`

- [ ] **Step 1: Escrever os testes da função pura**

```typescript
// lib/relatorios/centros-de-custo.test.ts
import { describe, expect, it } from 'vitest'
import {
  agruparMovimentacoesPorCentroDeCusto,
  SEM_CENTRO_ID,
  type MovimentacaoBrutaCentro,
} from './centros-de-custo'

function mov(overrides: Partial<MovimentacaoBrutaCentro> = {}): MovimentacaoBrutaCentro {
  return {
    id: 'mov-1',
    data: '2026-08-10',
    descricao: 'Lançamento teste',
    valor: 100,
    tipo: 'ENTRADA',
    categorias_movimentacao: { id: 'cat-1', nome: 'Mensalidade' },
    ...overrides,
  }
}

describe('agruparMovimentacoesPorCentroDeCusto', () => {
  it('soma o valor de uma movimentação no centro vinculado à sua categoria', () => {
    const resultado = agruparMovimentacoesPorCentroDeCusto(
      [mov({ valor: 150, tipo: 'ENTRADA' })],
      [{ id: 'centro-1', nome: 'Administrativo', cor: '#000000' }],
      [{ centroDeCustoId: 'centro-1', categoriaId: 'cat-1' }]
    )

    const centro = resultado.find((c) => c.id === 'centro-1')!
    expect(centro.totalEntradas).toBe(150)
    expect(centro.totalSaidas).toBe(0)
    expect(centro.saldo).toBe(150)
    expect(centro.movimentacoes).toHaveLength(1)
  })

  it('conta a mesma movimentação em dois centros quando a categoria está vinculada a ambos', () => {
    const resultado = agruparMovimentacoesPorCentroDeCusto(
      [mov({ valor: 100 })],
      [
        { id: 'centro-1', nome: 'Administrativo', cor: '#000000' },
        { id: 'centro-2', nome: 'Eventos', cor: '#111111' },
      ],
      [
        { centroDeCustoId: 'centro-1', categoriaId: 'cat-1' },
        { centroDeCustoId: 'centro-2', categoriaId: 'cat-1' },
      ]
    )

    expect(resultado.find((c) => c.id === 'centro-1')!.totalEntradas).toBe(100)
    expect(resultado.find((c) => c.id === 'centro-2')!.totalEntradas).toBe(100)
  })

  it('agrupa categorias sem nenhum centro vinculado no pseudo-centro "Sem centro de custo"', () => {
    const resultado = agruparMovimentacoesPorCentroDeCusto(
      [mov({ valor: 80, categorias_movimentacao: { id: 'cat-solta', nome: 'Tronco' } })],
      [{ id: 'centro-1', nome: 'Administrativo', cor: '#000000' }],
      []
    )

    const semCentro = resultado.find((c) => c.id === SEM_CENTRO_ID)
    expect(semCentro).toBeDefined()
    expect(semCentro!.totalEntradas).toBe(80)
    expect(resultado.find((c) => c.id === 'centro-1')!.totalEntradas).toBe(0)
  })

  it('não inclui o pseudo-centro "Sem centro de custo" quando toda categoria está vinculada a algum centro', () => {
    const resultado = agruparMovimentacoesPorCentroDeCusto(
      [mov({ valor: 50 })],
      [{ id: 'centro-1', nome: 'Administrativo', cor: '#000000' }],
      [{ centroDeCustoId: 'centro-1', categoriaId: 'cat-1' }]
    )

    expect(resultado.find((c) => c.id === SEM_CENTRO_ID)).toBeUndefined()
  })

  it('inclui centros cadastrados sem nenhuma movimentação no período com totais zerados', () => {
    const resultado = agruparMovimentacoesPorCentroDeCusto(
      [],
      [{ id: 'centro-1', nome: 'Administrativo', cor: '#000000' }],
      []
    )

    const centro = resultado.find((c) => c.id === 'centro-1')!
    expect(centro.totalEntradas).toBe(0)
    expect(centro.totalSaidas).toBe(0)
    expect(centro.saldo).toBe(0)
    expect(centro.movimentacoes).toHaveLength(0)
  })

  it('calcula entradas e saídas separadamente e o saldo do centro', () => {
    const resultado = agruparMovimentacoesPorCentroDeCusto(
      [
        mov({ id: 'mov-1', valor: 300, tipo: 'ENTRADA' }),
        mov({ id: 'mov-2', valor: 120, tipo: 'SAIDA', categorias_movimentacao: { id: 'cat-1', nome: 'Mensalidade' } }),
      ],
      [{ id: 'centro-1', nome: 'Administrativo', cor: '#000000' }],
      [{ centroDeCustoId: 'centro-1', categoriaId: 'cat-1' }]
    )

    const centro = resultado.find((c) => c.id === 'centro-1')!
    expect(centro.totalEntradas).toBe(300)
    expect(centro.totalSaidas).toBe(120)
    expect(centro.saldo).toBe(180)
  })

  it('agrega o breakdown por categoria dentro do centro', () => {
    const resultado = agruparMovimentacoesPorCentroDeCusto(
      [
        mov({ id: 'mov-1', valor: 100, categorias_movimentacao: { id: 'cat-1', nome: 'Mensalidade' } }),
        mov({ id: 'mov-2', valor: 50, categorias_movimentacao: { id: 'cat-1', nome: 'Mensalidade' } }),
        mov({ id: 'mov-3', valor: 30, categorias_movimentacao: { id: 'cat-2', nome: 'Tronco' } }),
      ],
      [{ id: 'centro-1', nome: 'Administrativo', cor: '#000000' }],
      [
        { centroDeCustoId: 'centro-1', categoriaId: 'cat-1' },
        { centroDeCustoId: 'centro-1', categoriaId: 'cat-2' },
      ]
    )

    const centro = resultado.find((c) => c.id === 'centro-1')!
    expect(centro.porCategoria).toHaveLength(2)
    expect(centro.porCategoria.find((c) => c.categoriaId === 'cat-1')!.valor).toBe(150)
    expect(centro.porCategoria.find((c) => c.categoriaId === 'cat-2')!.valor).toBe(30)
  })

  it('aceita relação de categoria como array (formato alternativo do Supabase)', () => {
    const resultado = agruparMovimentacoesPorCentroDeCusto(
      [mov({ valor: 75, categorias_movimentacao: [{ id: 'cat-1', nome: 'Mensalidade' }] })],
      [{ id: 'centro-1', nome: 'Administrativo', cor: '#000000' }],
      [{ centroDeCustoId: 'centro-1', categoriaId: 'cat-1' }]
    )

    expect(resultado.find((c) => c.id === 'centro-1')!.totalEntradas).toBe(75)
  })

  it('ignora movimentação sem categoria associada', () => {
    const resultado = agruparMovimentacoesPorCentroDeCusto(
      [mov({ categorias_movimentacao: null })],
      [{ id: 'centro-1', nome: 'Administrativo', cor: '#000000' }],
      []
    )

    expect(resultado.find((c) => c.id === SEM_CENTRO_ID)).toBeUndefined()
    expect(resultado.find((c) => c.id === 'centro-1')!.totalEntradas).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run lib/relatorios/centros-de-custo.test.ts`
Expected: FAIL — `Cannot find module './centros-de-custo'` (o arquivo de implementação ainda não existe).

- [ ] **Step 3: Implementar `lib/relatorios/centros-de-custo.ts`**

```typescript
import type { createSupabaseServerClient } from '@/lib/supabase/server'

export type FiltrosCentrosDeCusto = {
  dataInicio?: string
  dataFim?: string
}

export type CentroDeCustoInput = { id: string; nome: string; cor: string }
export type VinculoCentroCategoria = { centroDeCustoId: string; categoriaId: string }

type RelacaoCategoria = { id: string; nome: string }

export type MovimentacaoBrutaCentro = {
  id: string
  data: string
  descricao: string | null
  valor: number | string
  tipo: 'ENTRADA' | 'SAIDA'
  categorias_movimentacao: RelacaoCategoria[] | RelacaoCategoria | null
}

export type MovimentacaoCentro = {
  id: string
  data: string
  categoria: string
  descricao: string
  valor: number
  tipo: 'ENTRADA' | 'SAIDA'
}

export type CategoriaResumoCentro = {
  categoriaId: string
  nome: string
  tipo: 'ENTRADA' | 'SAIDA'
  valor: number
}

export type CentroDeCustoResumo = {
  id: string
  nome: string
  cor: string
  totalEntradas: number
  totalSaidas: number
  saldo: number
  porCategoria: CategoriaResumoCentro[]
  movimentacoes: MovimentacaoCentro[]
}

export const SEM_CENTRO_ID = 'sem-centro'
const SEM_CENTRO_NOME = 'Sem centro de custo'
const SEM_CENTRO_COR = '#94a3b8'

function primeiro<T>(rel: T[] | T | null): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

type Acumulador = {
  resumo: CentroDeCustoResumo
  porCategoria: Map<string, CategoriaResumoCentro>
}

/** Agrupa movimentações ATIVAS por centro de custo, via vínculo categoria → centro(s). Função pura — sem I/O. */
export function agruparMovimentacoesPorCentroDeCusto(
  movimentacoes: MovimentacaoBrutaCentro[],
  centros: CentroDeCustoInput[],
  vinculos: VinculoCentroCategoria[]
): CentroDeCustoResumo[] {
  const centrosPorCategoria = new Map<string, string[]>()
  for (const vinculo of vinculos) {
    const lista = centrosPorCategoria.get(vinculo.categoriaId) ?? []
    lista.push(vinculo.centroDeCustoId)
    centrosPorCategoria.set(vinculo.categoriaId, lista)
  }

  const acumuladores = new Map<string, Acumulador>()

  function acumuladorDe(id: string, nome: string, cor: string): Acumulador {
    let acc = acumuladores.get(id)
    if (!acc) {
      acc = {
        resumo: { id, nome, cor, totalEntradas: 0, totalSaidas: 0, saldo: 0, porCategoria: [], movimentacoes: [] },
        porCategoria: new Map(),
      }
      acumuladores.set(id, acc)
    }
    return acc
  }

  for (const centro of centros) {
    acumuladorDe(centro.id, centro.nome, centro.cor)
  }

  for (const mov of movimentacoes) {
    const categoria = primeiro(mov.categorias_movimentacao)
    if (!categoria) continue

    const valor = Number(mov.valor)
    const centrosDaCategoria = centrosPorCategoria.get(categoria.id) ?? []
    const destinos = centrosDaCategoria.length > 0 ? centrosDaCategoria : [SEM_CENTRO_ID]

    for (const centroId of destinos) {
      const acc = acumuladorDe(centroId, centroId === SEM_CENTRO_ID ? SEM_CENTRO_NOME : centroId, SEM_CENTRO_COR)

      if (mov.tipo === 'ENTRADA') {
        acc.resumo.totalEntradas += valor
      } else {
        acc.resumo.totalSaidas += valor
      }
      acc.resumo.saldo = acc.resumo.totalEntradas - acc.resumo.totalSaidas

      acc.resumo.movimentacoes.push({
        id: mov.id,
        data: mov.data,
        categoria: categoria.nome,
        descricao: mov.descricao ?? '-',
        valor,
        tipo: mov.tipo,
      })

      const categoriaAcc = acc.porCategoria.get(categoria.id)
      if (categoriaAcc) {
        categoriaAcc.valor += valor
      } else {
        acc.porCategoria.set(categoria.id, { categoriaId: categoria.id, nome: categoria.nome, tipo: mov.tipo, valor })
      }
    }
  }

  const resultado: CentroDeCustoResumo[] = []
  for (const centro of centros) {
    const acc = acumuladores.get(centro.id)!
    resultado.push({
      ...acc.resumo,
      porCategoria: [...acc.porCategoria.values()].sort((a, b) => b.valor - a.valor),
      movimentacoes: [...acc.resumo.movimentacoes].sort((a, b) => (a.data < b.data ? 1 : -1)),
    })
  }

  const semCentro = acumuladores.get(SEM_CENTRO_ID)
  if (semCentro && semCentro.resumo.movimentacoes.length > 0) {
    resultado.push({
      ...semCentro.resumo,
      porCategoria: [...semCentro.porCategoria.values()].sort((a, b) => b.valor - a.valor),
      movimentacoes: [...semCentro.resumo.movimentacoes].sort((a, b) => (a.data < b.data ? 1 : -1)),
    })
  }

  return resultado
}

export async function buscarDadosCentrosDeCusto(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filtros: FiltrosCentrosDeCusto
): Promise<CentroDeCustoResumo[]> {
  const [centrosRes, vinculosRes, movimentacoesRes] = await Promise.all([
    supabase.from('centros_de_custo').select('id, nome, cor').eq('ativo', true).order('nome'),
    supabase.from('centros_de_custo_categorias').select('centro_de_custo_id, categoria_id'),
    (() => {
      let query = supabase
        .from('movimentacoes')
        .select('id, data, descricao, valor, tipo, categorias_movimentacao(id, nome)')
        .eq('status', 'ATIVO')
      if (filtros.dataInicio) query = query.gte('data', filtros.dataInicio)
      if (filtros.dataFim) query = query.lte('data', filtros.dataFim)
      return query
    })(),
  ])

  if (centrosRes.error) throw centrosRes.error
  if (vinculosRes.error) throw vinculosRes.error
  if (movimentacoesRes.error) throw movimentacoesRes.error

  const centros: CentroDeCustoInput[] = (centrosRes.data ?? []).map((c) => ({ id: c.id, nome: c.nome, cor: c.cor }))
  const vinculos: VinculoCentroCategoria[] = (vinculosRes.data ?? []).map((v) => ({
    centroDeCustoId: v.centro_de_custo_id,
    categoriaId: v.categoria_id,
  }))

  return agruparMovimentacoesPorCentroDeCusto(
    (movimentacoesRes.data ?? []) as unknown as MovimentacaoBrutaCentro[],
    centros,
    vinculos
  )
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run lib/relatorios/centros-de-custo.test.ts`
Expected: PASS — todos os 9 testes passando.

- [ ] **Step 5: Commit**

```bash
git add lib/relatorios/centros-de-custo.ts lib/relatorios/centros-de-custo.test.ts
git commit -m "feat: adiciona agrupamento de movimentacoes por centro de custo"
```

---

### Task 3: Server actions de Centros de Custo (Configurações)

**Files:**
- Create: `app/(app)/configuracoes/centros-de-custo/actions.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `AuthorizationError` de `@/lib/auth/require-role`; `createSupabaseServiceRoleClient` de `@/lib/supabase/service`; `registrarAuditoria` de `@/lib/audit`.
- Produces (usados pela Task 4):
  - `criarCentroDeCusto(_prevState: ActionState, formData: FormData): Promise<ActionState>` — campos `nome`, `cor`.
  - `atualizarCentroDeCusto(id: string, dados: { nome: string; cor: string; ativo: boolean }): Promise<{ error?: string }>`
  - `atualizarCategoriasDoCentro(id: string, categoriaIds: string[]): Promise<{ error?: string }>`

- [ ] **Step 1: Implementar as actions**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

const HEX_COR_REGEX = /^#[0-9a-fA-F]{6}$/

export async function criarCentroDeCusto(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const nome = String(formData.get('nome') ?? '').trim()
  const cor = String(formData.get('cor') ?? '').trim()

  if (nome.length === 0) {
    return { error: 'Informe o nome do centro de custo.' }
  }
  if (!HEX_COR_REGEX.test(cor)) {
    return { error: 'Selecione uma cor válida.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: criado, error } = await supabaseAdmin
    .from('centros_de_custo')
    .insert({ nome, cor })
    .select('id')
    .single()

  if (error || !criado) {
    if (error?.code === '23505') {
      return { error: 'Já existe um centro de custo com esse nome.' }
    }
    return { error: `Falha ao criar centro de custo: ${error?.message ?? 'erro desconhecido'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'CRIACAO_CENTRO_CUSTO',
      registroTabela: 'centros_de_custo',
      registroId: criado.id,
      dadosNovos: { nome, cor },
      descricao: `Criação do centro de custo ${nome}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (centro de custo criado com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/centros-de-custo')
  revalidatePath('/financeiro')
  return { success: 'Centro de custo criado com sucesso.' }
}

export async function atualizarCentroDeCusto(
  id: string,
  dados: { nome: string; cor: string; ativo: boolean }
): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  if (dados.nome.trim().length === 0) {
    return { error: 'Informe o nome do centro de custo.' }
  }
  if (!HEX_COR_REGEX.test(dados.cor)) {
    return { error: 'Selecione uma cor válida.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anterior } = await supabaseAdmin
    .from('centros_de_custo')
    .select('nome, cor, ativo')
    .eq('id', id)
    .single()

  const { data: atualizado, error } = await supabaseAdmin
    .from('centros_de_custo')
    .update({ nome: dados.nome.trim(), cor: dados.cor, ativo: dados.ativo })
    .eq('id', id)
    .select('id')
    .single()

  if (error || !atualizado) {
    return { error: `Falha ao atualizar centro de custo: ${error?.message ?? 'não encontrado'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'EDICAO_CENTRO_CUSTO',
      registroTabela: 'centros_de_custo',
      registroId: id,
      dadosAnteriores: anterior ?? null,
      dadosNovos: dados,
      descricao: `Edição do centro de custo ${id}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (centro de custo atualizado com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/centros-de-custo')
  revalidatePath('/financeiro')
  return {}
}

export async function atualizarCategoriasDoCentro(id: string, categoriaIds: string[]): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: anteriores } = await supabaseAdmin
    .from('centros_de_custo_categorias')
    .select('categoria_id')
    .eq('centro_de_custo_id', id)

  const { error: deleteError } = await supabaseAdmin
    .from('centros_de_custo_categorias')
    .delete()
    .eq('centro_de_custo_id', id)

  if (deleteError) {
    return { error: `Falha ao atualizar categorias do centro: ${deleteError.message}` }
  }

  if (categoriaIds.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from('centros_de_custo_categorias')
      .insert(categoriaIds.map((categoriaId) => ({ centro_de_custo_id: id, categoria_id: categoriaId })))

    if (insertError) {
      return { error: `Falha ao atualizar categorias do centro: ${insertError.message}` }
    }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'EDICAO_CATEGORIAS_CENTRO_CUSTO',
      registroTabela: 'centros_de_custo_categorias',
      registroId: id,
      dadosAnteriores: { categoriaIds: (anteriores ?? []).map((a) => a.categoria_id) },
      dadosNovos: { categoriaIds },
      descricao: `Atualização das categorias do centro de custo ${id}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (categorias do centro atualizadas com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/centros-de-custo')
  revalidatePath('/financeiro')
  return {}
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros originados por `app/(app)/configuracoes/centros-de-custo/actions.ts` (a página/lista ainda não existem, então imports não resolvidos deste arquivo são esperados até a Task 4 — rodar mesmo assim só para confirmar que a sintaxe do próprio arquivo está correta).

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/configuracoes/centros-de-custo/actions.ts"
git commit -m "feat: adiciona actions de centros de custo em configuracoes"
```

---

### Task 4: Tela de Configurações → Centros de Custo

**Files:**
- Create: `app/(app)/configuracoes/centros-de-custo/page.tsx`
- Create: `app/(app)/configuracoes/centros-de-custo/NovoCentroForm.tsx`
- Create: `app/(app)/configuracoes/centros-de-custo/CentrosDeCustoList.tsx`
- Modify: `app/(app)/configuracoes/page.tsx`

**Interfaces:**
- Consumes: `criarCentroDeCusto`, `atualizarCentroDeCusto`, `atualizarCategoriasDoCentro` da Task 3.

- [ ] **Step 1: Criar o formulário de novo centro**

```tsx
// app/(app)/configuracoes/centros-de-custo/NovoCentroForm.tsx
'use client'

import { useActionState } from 'react'
import { criarCentroDeCusto } from './actions'

export function NovoCentroForm() {
  const [state, formAction, pending] = useActionState(criarCentroDeCusto, undefined)

  return (
    <form action={formAction} className="max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">Novo centro de custo</h2>

      <div className="space-y-1">
        <label htmlFor="nome" className="text-sm font-medium text-slate-700">
          Nome
        </label>
        <input
          id="nome"
          name="nome"
          type="text"
          required
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="cor" className="text-sm font-medium text-slate-700">
          Cor
        </label>
        <input id="cor" name="cor" type="color" defaultValue="#64748b" className="h-9 w-16 rounded border border-slate-300" />
      </div>

      {state && 'error' in state && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state && 'success' in state && (
        <p className="text-sm text-green-700" role="status">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Criando...' : 'Criar'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Criar a lista/editor de centros**

```tsx
// app/(app)/configuracoes/centros-de-custo/CentrosDeCustoList.tsx
'use client'

import { useState, useTransition } from 'react'
import { atualizarCentroDeCusto, atualizarCategoriasDoCentro } from './actions'

type Categoria = { id: string; nome: string; tipo: 'ENTRADA' | 'SAIDA' }
type Centro = { id: string; nome: string; cor: string; ativo: boolean; categoriaIds: string[] }

export function CentrosDeCustoList({ centros, categorias }: { centros: Centro[]; categorias: Categoria[] }) {
  const [expandidoId, setExpandidoId] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {centros.map((centro) => (
        <CentroRow
          key={centro.id}
          centro={centro}
          categorias={categorias}
          expandido={expandidoId === centro.id}
          onToggleExpandir={() => setExpandidoId(expandidoId === centro.id ? null : centro.id)}
        />
      ))}
    </div>
  )
}

function CentroRow({
  centro,
  categorias,
  expandido,
  onToggleExpandir,
}: {
  centro: Centro
  categorias: Categoria[]
  expandido: boolean
  onToggleExpandir: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [nome, setNome] = useState(centro.nome)
  const [cor, setCor] = useState(centro.cor)
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null)
  const [categoriaIds, setCategoriaIds] = useState<Set<string>>(new Set(centro.categoriaIds))

  function handleSalvarDados() {
    startTransition(async () => {
      const result = await atualizarCentroDeCusto(centro.id, { nome, cor, ativo: centro.ativo })
      setFeedback({ message: result.error ?? 'Centro de custo atualizado.', isError: Boolean(result.error) })
    })
  }

  function handleToggleAtivo() {
    const confirmMessage = centro.ativo ? `Desativar o centro ${centro.nome}?` : `Reativar o centro ${centro.nome}?`
    if (!window.confirm(confirmMessage)) return

    startTransition(async () => {
      const result = await atualizarCentroDeCusto(centro.id, { nome, cor, ativo: !centro.ativo })
      setFeedback({ message: result.error ?? 'Status atualizado.', isError: Boolean(result.error) })
    })
  }

  function handleToggleCategoria(categoriaId: string) {
    setCategoriaIds((prev) => {
      const next = new Set(prev)
      if (next.has(categoriaId)) {
        next.delete(categoriaId)
      } else {
        next.add(categoriaId)
      }
      return next
    })
  }

  function handleSalvarCategorias() {
    startTransition(async () => {
      const result = await atualizarCategoriasDoCentro(centro.id, [...categoriaIds])
      setFeedback({ message: result.error ?? 'Categorias do centro atualizadas.', isError: Boolean(result.error) })
    })
  }

  const entradas = categorias.filter((c) => c.tipo === 'ENTRADA')
  const saidas = categorias.filter((c) => c.tipo === 'SAIDA')

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-block h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: centro.cor }} />
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="min-w-[10rem] flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <input
          type="color"
          value={cor}
          onChange={(e) => setCor(e.target.value)}
          className="h-8 w-12 rounded border border-slate-300"
        />
        <span className={centro.ativo ? 'text-sm text-green-700' : 'text-sm text-slate-400'}>
          {centro.ativo ? 'Ativo' : 'Inativo'}
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={handleSalvarDados}
          className="text-sm text-slate-700 underline disabled:opacity-50"
        >
          Salvar
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={handleToggleAtivo}
          className="text-sm text-slate-700 underline disabled:opacity-50"
        >
          {centro.ativo ? 'Desativar' : 'Reativar'}
        </button>
        <button type="button" onClick={onToggleExpandir} className="text-sm text-slate-700 underline">
          {expandido ? 'Ocultar categorias' : 'Categorias'}
        </button>
      </div>

      {feedback && (
        <p className={`mt-2 text-sm ${feedback.isError ? 'text-red-600' : 'text-green-700'}`} role={feedback.isError ? 'alert' : 'status'}>
          {feedback.message}
        </p>
      )}

      {expandido && (
        <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Entradas</h3>
            <ul className="space-y-1">
              {entradas.map((categoria) => (
                <li key={categoria.id}>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={categoriaIds.has(categoria.id)}
                      onChange={() => handleToggleCategoria(categoria.id)}
                    />
                    {categoria.nome}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Saídas</h3>
            <ul className="space-y-1">
              {saidas.map((categoria) => (
                <li key={categoria.id}>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={categoriaIds.has(categoria.id)}
                      onChange={() => handleToggleCategoria(categoria.id)}
                    />
                    {categoria.nome}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleSalvarCategorias}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Salvar categorias
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Criar a página**

```tsx
// app/(app)/configuracoes/centros-de-custo/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { NovoCentroForm } from './NovoCentroForm'
import { CentrosDeCustoList } from './CentrosDeCustoList'

export default async function CentrosDeCustoConfigPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'ADMINISTRADOR') {
    return <AcessoNegado />
  }

  const [{ data: centros, error: centrosError }, { data: categorias, error: categoriasError }, { data: vinculos }] =
    await Promise.all([
      supabase.from('centros_de_custo').select('id, nome, cor, ativo').order('nome'),
      supabase.from('categorias_movimentacao').select('id, nome, tipo').eq('ativo', true).order('tipo').order('nome'),
      supabase.from('centros_de_custo_categorias').select('centro_de_custo_id, categoria_id'),
    ])

  if (centrosError || categoriasError) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar centros de custo: {(centrosError ?? categoriasError)?.message}
      </div>
    )
  }

  const centrosComCategorias = (centros ?? []).map((centro) => ({
    ...centro,
    categoriaIds: (vinculos ?? [])
      .filter((v) => v.centro_de_custo_id === centro.id)
      .map((v) => v.categoria_id),
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Configurações — Centros de custo</h1>
      <NovoCentroForm />
      {centrosComCategorias.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum centro de custo cadastrado.</p>
      ) : (
        <CentrosDeCustoList centros={centrosComCategorias} categorias={categorias ?? []} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Adicionar o link em Configurações**

Em `app/(app)/configuracoes/page.tsx`, adicionar ao array `SECOES` (após a entrada de "Categorias de movimentação"):

```typescript
  { titulo: 'Centros de custo', href: '/configuracoes/centros-de-custo', apenasAdmin: true },
```

- [ ] **Step 5: Checar tipos e build**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/configuracoes/centros-de-custo" "app/(app)/configuracoes/page.tsx"
git commit -m "feat: adiciona tela de configuracoes de centros de custo"
```

---

### Task 5: Mover a tabela de Movimentações para `/financeiro/movimentacoes`

**Files:**
- Create: `app/(app)/financeiro/movimentacoes/page.tsx` (conteúdo movido de `app/(app)/financeiro/page.tsx`)
- Modify: `app/(app)/financeiro/FinanceiroTabs.tsx`
- Modify: `app/(app)/financeiro/actions.ts` (revalidatePath)
- Modify: `app/(app)/campanhas/[id]/actions.ts` (revalidatePath)
- Modify: `app/(app)/anexos/actions.ts` (revalidatePath)
- Modify: `app/(app)/grande-loja/actions.ts` (revalidatePath)
- Modify: `app/(app)/dashboard/page.tsx` (link "Ver todas")

**Interfaces:**
- Consumes: `MovimentacoesTable` de `app/(app)/financeiro/MovimentacoesTable.tsx` (permanece no lugar, só muda o caminho relativo do import).

- [ ] **Step 1: Criar `app/(app)/financeiro/movimentacoes/page.tsx` com o conteúdo atual de `financeiro/page.tsx`**

Copiar o conteúdo integral atual de `app/(app)/financeiro/page.tsx` para o novo arquivo, ajustando os imports relativos (`./FinanceiroTabs` → `../FinanceiroTabs`, `./MovimentacoesTable` → `../MovimentacoesTable`, `./actions` não é importado neste arquivo — sem alteração de lógica, filtros ou queries):

```tsx
// app/(app)/financeiro/movimentacoes/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { FinanceiroTabs } from '../FinanceiroTabs'
import { MovimentacoesTable } from '../MovimentacoesTable'
import { formatarMoedaBR } from '@/lib/format'

type SearchParams = {
  dataInicio?: string
  dataFim?: string
  tipo?: string
  categoriaId?: string
  contaId?: string
  formaPagamentoId?: string
  membroId?: string
}

export default async function MovimentacoesPage({
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

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const podeEditar = profile?.role === 'ADMINISTRADOR' || profile?.role === 'TESOUREIRO'

  const [categorias, contas, formasPagamento, membros] = await Promise.all([
    supabase.from('categorias_movimentacao').select('id, nome, tipo').order('tipo').order('nome'),
    supabase.from('contas').select('id, nome').order('nome'),
    supabase.from('formas_pagamento').select('id, nome').order('nome'),
    supabase.from('membros').select('id, nome').order('nome'),
  ])

  let query = supabase
    .from('movimentacoes')
    .select(
      'id, data, tipo, descricao, valor, origem, status, motivo_cancelamento, categorias_movimentacao(nome), contas(nome), formas_pagamento(nome), membros(nome)'
    )
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })

  if (params.dataInicio) query = query.gte('data', params.dataInicio)
  if (params.dataFim) query = query.lte('data', params.dataFim)
  if (params.tipo) query = query.eq('tipo', params.tipo)
  if (params.categoriaId) query = query.eq('categoria_id', params.categoriaId)
  if (params.contaId) query = query.eq('conta_id', params.contaId)
  if (params.formaPagamentoId) query = query.eq('forma_pagamento_id', params.formaPagamentoId)
  if (params.membroId) query = query.eq('membro_id', params.membroId)

  const { data: movimentacoes, error } = await query

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar movimentações: {error.message}
      </div>
    )
  }

  let anexosPorMovimentacao: Record<string, { id: string; nome_arquivo: string; tamanho_bytes: number; criado_em: string }[]> = {}
  if ((movimentacoes ?? []).length > 0) {
    const { data: anexosData } = await supabase
      .from('anexos')
      .select('id, nome_arquivo, tamanho_bytes, criado_em, entidade_id')
      .eq('entidade_tipo', 'MOVIMENTACAO')
      .eq('status', 'ATIVO')
      .in(
        'entidade_id',
        (movimentacoes ?? []).map((m) => m.id)
      )
      .order('criado_em', { ascending: false })

    anexosPorMovimentacao = {}
    for (const anexo of anexosData ?? []) {
      const lista = anexosPorMovimentacao[anexo.entidade_id] ?? []
      lista.push(anexo)
      anexosPorMovimentacao[anexo.entidade_id] = lista
    }
  }

  const ativas = (movimentacoes ?? []).filter((m) => m.status === 'ATIVO')
  const totalEntradas = ativas.filter((m) => m.tipo === 'ENTRADA').reduce((s, m) => s + Number(m.valor), 0)
  const totalSaidas = ativas.filter((m) => m.tipo === 'SAIDA').reduce((s, m) => s + Number(m.valor), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Financeiro</h1>
      <FinanceiroTabs />

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">De</label>
          <input type="date" name="dataInicio" defaultValue={params.dataInicio} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Até</label>
          <input type="date" name="dataFim" defaultValue={params.dataFim} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Tipo</label>
          <select name="tipo" defaultValue={params.tipo ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todos</option>
            <option value="ENTRADA">Entrada</option>
            <option value="SAIDA">Saída</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Categoria</label>
          <select name="categoriaId" defaultValue={params.categoriaId ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todas</option>
            {(categorias.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({c.tipo === 'ENTRADA' ? 'E' : 'S'})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Conta</label>
          <select name="contaId" defaultValue={params.contaId ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todas</option>
            {(contas.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Forma de pagamento</label>
          <select name="formaPagamentoId" defaultValue={params.formaPagamentoId ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todas</option>
            {(formasPagamento.data ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-slate-500">Membro</label>
          <select name="membroId" defaultValue={params.membroId ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todos</option>
            {(membros.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Filtrar
          </button>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total entradas (ativas)</p>
          <p className="text-lg font-semibold text-green-700">{formatarMoedaBR(totalEntradas)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total saídas (ativas)</p>
          <p className="text-lg font-semibold text-red-700">{formatarMoedaBR(totalSaidas)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Saldo do período filtrado</p>
          <p className="text-lg font-semibold text-slate-900">{formatarMoedaBR(totalEntradas - totalSaidas)}</p>
        </div>
      </div>

      {(movimentacoes ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma movimentação encontrada.</p>
      ) : (
        <MovimentacoesTable
          movimentacoes={movimentacoes ?? []}
          podeEditar={podeEditar}
          anexosPorMovimentacao={anexosPorMovimentacao}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Apagar o conteúdo antigo de `app/(app)/financeiro/page.tsx`**

Deixar o arquivo vazio por enquanto — será recriado com o novo conteúdo de "Visão geral" na Task 6. (Se preferir, apague o arquivo agora com `rm "app/(app)/financeiro/page.tsx"`; a Task 6 recria-o do zero.)

Run: `rm "app/(app)/financeiro/page.tsx"`

- [ ] **Step 3: Atualizar `FinanceiroTabs.tsx`**

```tsx
// app/(app)/financeiro/FinanceiroTabs.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/financeiro', label: 'Visão geral' },
  { href: '/financeiro/movimentacoes', label: 'Movimentações' },
  { href: '/financeiro/nova', label: 'Nova movimentação' },
  { href: '/financeiro/transferencias', label: 'Transferências' },
  { href: '/financeiro/fechamento', label: 'Fechamento mensal' },
] as const

export function FinanceiroTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-slate-200 text-sm">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              isActive
                ? 'shrink-0 whitespace-nowrap border-b-2 border-slate-900 px-3 py-2 font-medium text-slate-900'
                : 'shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-slate-500 hover:text-slate-900'
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Atualizar `revalidatePath('/financeiro')` para `/financeiro/movimentacoes` nos arquivos que alteram movimentações**

Em cada um dos arquivos abaixo, trocar toda ocorrência de `revalidatePath('/financeiro')` por duas chamadas — uma para a aba nova de movimentações e uma para a visão geral (os totais dos cards também mudam quando uma movimentação é criada/cancelada/editada):

```typescript
  revalidatePath('/financeiro')
  revalidatePath('/financeiro/movimentacoes')
```

Arquivos e linhas a alterar:
- `app/(app)/financeiro/actions.ts:99`, `:176`, `:338`
- `app/(app)/campanhas/[id]/actions.ts:119`, `:191`
- `app/(app)/anexos/actions.ts:94`
- `app/(app)/grande-loja/actions.ts:128`, `:302`

- [ ] **Step 5: Atualizar o link "Ver todas" no Dashboard**

Em `app/(app)/dashboard/page.tsx:143`, trocar:

```tsx
            <Link href="/financeiro" className="text-xs text-slate-500 underline">
```

por:

```tsx
            <Link href="/financeiro/movimentacoes" className="text-xs text-slate-500 underline">
```

- [ ] **Step 6: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros (a rota `/financeiro` fica temporariamente sem `page.tsx` — Next.js não reclama disso em `tsc --noEmit`; a ausência será resolvida na Task 6).

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/financeiro/movimentacoes/page.tsx" "app/(app)/financeiro/FinanceiroTabs.tsx" "app/(app)/financeiro/actions.ts" "app/(app)/campanhas/[id]/actions.ts" "app/(app)/anexos/actions.ts" "app/(app)/grande-loja/actions.ts" "app/(app)/dashboard/page.tsx"
git add -u "app/(app)/financeiro/page.tsx"
git commit -m "refactor: move tabela de movimentacoes para aba propria em /financeiro/movimentacoes"
```

---

### Task 6: Aba "Visão geral" — cards de centro de custo + modal de detalhe

**Files:**
- Create: `app/(app)/financeiro/page.tsx`
- Create: `app/(app)/financeiro/CentrosDeCustoGrid.tsx`

**Interfaces:**
- Consumes: `buscarDadosCentrosDeCusto`, `type CentroDeCustoResumo` de `@/lib/relatorios/centros-de-custo` (Task 2); `FinanceiroTabs` de `./FinanceiroTabs`; `formatarMoedaBR`, `formatarDataBR` de `@/lib/format`.

- [ ] **Step 1: Criar o grid de cards + modal (client component)**

```tsx
// app/(app)/financeiro/CentrosDeCustoGrid.tsx
'use client'

import { useState } from 'react'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'
import type { CentroDeCustoResumo } from '@/lib/relatorios/centros-de-custo'

export function CentrosDeCustoGrid({ centros }: { centros: CentroDeCustoResumo[] }) {
  const [selecionado, setSelecionado] = useState<CentroDeCustoResumo | null>(null)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {centros.map((centro) => (
          <button
            key={centro.id}
            type="button"
            onClick={() => setSelecionado(centro)}
            className="rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: centro.cor }} />
              <h3 className="text-sm font-semibold text-slate-900">{centro.nome}</h3>
            </div>

            <ProporcaoBarra entradas={centro.totalEntradas} saidas={centro.totalSaidas} />

            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Entradas</dt>
                <dd className="font-medium text-green-700">{formatarMoedaBR(centro.totalEntradas)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Saídas</dt>
                <dd className="font-medium text-red-700">{formatarMoedaBR(centro.totalSaidas)}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-1">
                <dt className="text-slate-700">Saldo</dt>
                <dd className="font-semibold text-slate-900">{formatarMoedaBR(centro.saldo)}</dd>
              </div>
            </dl>
          </button>
        ))}
      </div>

      {selecionado && <DetalheModal centro={selecionado} onClose={() => setSelecionado(null)} />}
    </>
  )
}

function ProporcaoBarra({ entradas, saidas }: { entradas: number; saidas: number }) {
  const total = entradas + saidas
  const percEntradas = total > 0 ? (entradas / total) * 100 : 0

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-red-100">
      <div className="h-full bg-green-600" style={{ width: `${percEntradas}%` }} />
    </div>
  )
}

function DetalheModal({ centro, onClose }: { centro: CentroDeCustoResumo; onClose: () => void }) {
  const totalGeral = centro.totalEntradas + centro.totalSaidas

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: centro.cor }} />
            <h2 className="text-base font-semibold text-slate-900">{centro.nome}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 underline">
            Fechar
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Entradas</p>
            <p className="font-semibold text-green-700">{formatarMoedaBR(centro.totalEntradas)}</p>
          </div>
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Saídas</p>
            <p className="font-semibold text-red-700">{formatarMoedaBR(centro.totalSaidas)}</p>
          </div>
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Saldo</p>
            <p className="font-semibold text-slate-900">{formatarMoedaBR(centro.saldo)}</p>
          </div>
        </div>

        <h3 className="mb-2 text-sm font-semibold text-slate-900">Por categoria</h3>
        {centro.porCategoria.length === 0 ? (
          <p className="mb-4 text-sm text-slate-500">Nenhuma movimentação no período.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {centro.porCategoria.map((categoria) => {
              const percentual = totalGeral > 0 ? (categoria.valor / totalGeral) * 100 : 0
              return (
                <li key={categoria.categoriaId} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700">{categoria.nome}</span>
                    <span className={categoria.tipo === 'ENTRADA' ? 'font-medium text-green-700' : 'font-medium text-red-700'}>
                      {formatarMoedaBR(categoria.valor)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={categoria.tipo === 'ENTRADA' ? 'h-full rounded-full bg-green-600' : 'h-full rounded-full bg-red-600'}
                      style={{ width: `${percentual}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <h3 className="mb-2 text-sm font-semibold text-slate-900">Movimentações do período</h3>
        {centro.movimentacoes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma movimentação no período.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {centro.movimentacoes.map((mov) => (
              <li key={mov.id} className="flex items-center justify-between py-1.5">
                <div>
                  <p className="text-slate-900">{mov.categoria}</p>
                  <p className="text-xs text-slate-500">
                    {formatarDataBR(mov.data)} — {mov.descricao}
                  </p>
                </div>
                <span className={mov.tipo === 'ENTRADA' ? 'font-medium text-green-700' : 'font-medium text-red-700'}>
                  {mov.tipo === 'ENTRADA' ? '+' : '-'}
                  {formatarMoedaBR(mov.valor)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar a página "Visão geral"**

```tsx
// app/(app)/financeiro/page.tsx
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { FinanceiroTabs } from './FinanceiroTabs'
import { CentrosDeCustoGrid } from './CentrosDeCustoGrid'
import { buscarDadosCentrosDeCusto } from '@/lib/relatorios/centros-de-custo'

type SearchParams = { dataInicio?: string; dataFim?: string }

function primeiroDiaMesAtual(): string {
  const hoje = new Date()
  return `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default async function FinanceiroVisaoGeralPage({
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

  const dataInicio = params.dataInicio || primeiroDiaMesAtual()
  const dataFim = params.dataFim || hojeISO()

  const centros = await buscarDadosCentrosDeCusto(supabase, { dataInicio, dataFim })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Financeiro</h1>
      </div>
      <FinanceiroTabs />

      <form className="flex flex-wrap items-end gap-2 text-sm">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">De</label>
          <input type="date" name="dataInicio" defaultValue={dataInicio} className="rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Até</label>
          <input type="date" name="dataFim" defaultValue={dataFim} className="rounded border border-slate-300 px-2 py-1" />
        </div>
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Filtrar
        </button>
      </form>

      {centros.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhum centro de custo cadastrado.{' '}
          <Link href="/configuracoes/centros-de-custo" className="underline">
            Cadastre um em Configurações
          </Link>
          .
        </p>
      ) : (
        <CentrosDeCustoGrid centros={centros} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Rodar toda a suíte de testes**

Run: `npx vitest run`
Expected: PASS — todos os testes existentes continuam passando, incluindo os novos de `centros-de-custo.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/financeiro/page.tsx" "app/(app)/financeiro/CentrosDeCustoGrid.tsx"
git commit -m "feat: adiciona visao geral por centros de custo na tela financeiro"
```

---

### Task 7: Verificação manual no navegador

**Files:** nenhum (só validação)

- [ ] **Step 1: Subir o servidor de desenvolvimento e abrir `/configuracoes/centros-de-custo` logado como ADMINISTRADOR**

Criar 2 centros de custo (ex.: "Administrativo" cor azul, "Eventos" cor laranja), expandir cada um e marcar categorias — incluindo marcar a mesma categoria em ambos os centros para validar a sobreposição intencional.

- [ ] **Step 2: Abrir `/financeiro`**

Confirmar:
- A aba "Visão geral" é a primeira e ativa por padrão.
- Os cards mostram os centros criados, com cor, entradas/saídas/saldo do mês atual.
- Se houver categoria sem nenhum centro vinculado com movimentação no período, o card "Sem centro de custo" aparece por último.
- Clicar num card abre o modal com breakdown por categoria e lista de movimentações; clicar fora ou em "Fechar" fecha o modal.
- Mudar o período (De/Até) e filtrar atualiza os totais dos cards.

- [ ] **Step 3: Abrir a aba "Movimentações"**

Confirmar que a tabela e os filtros continuam funcionando exatamente como antes (mesma URL antiga agora em `/financeiro/movimentacoes`), e que registrar ou cancelar uma movimentação atualiza tanto essa aba quanto os totais da "Visão geral" ao voltar para ela.

- [ ] **Step 4: Checar com um usuário CONSULTA**

Confirmar que a Visão geral é visível (somente leitura) e que `/configuracoes/centros-de-custo` retorna `AcessoNegado`.

- [ ] **Step 5: Rodar a suíte completa de testes e o build de produção**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: tudo verde, sem erros de tipo ou de build.
