# Fase 6 — Mensalidades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Geração de competências de mensalidade, registro de pagamentos (integral, parcial, múltiplas competências, atrasados, acima do valor de uma competência), cancelamento de pagamento, e cálculo real de inadimplência conectado aos dados de mensalidade — o núcleo financeiro do sistema (SPEC §7-15).

**Architecture:** Regras de negócio puras e testadas em `lib/domain/` (geração de competências, alocação de pagamento, contagem de vencidas). Server Actions com `requireTesoureiro()` (Tesoureiro e Administrador podem operar mensalidades, SPEC §3) fazem toda escrita via `service_role`, com `registrarAuditoria` em cada operação. O rateio Loja/Grande Loja é preservado por *snapshot* — `mensalidades.valor_grande_loja`/`valor_loja` são gravados na criação da competência e nunca recalculados, então pagamento parcial não precisa lidar com rateio algum, só com o total devido daquela competência.

**Tech Stack:** Next.js Server Actions, Vitest.

## Global Constraints

- Rateio já preservado por snapshot (Fase 2): `valor_devido = valor_grande_loja + valor_loja`, gravado na criação da competência — esta fase nunca recalcula rateio, só lê os valores já gravados.
- `pagamento_mensalidades.valor_aplicado` nunca pode exceder o saldo da competência (`mensalidades.saldo`) — validado em domínio antes de qualquer escrita (decisão já registrada na Fase 2: constraint agregada fica na aplicação, não em trigger SQL).
- Pagamento acima do valor de uma competência: nunca criar competência nova automaticamente — o operador escolhe outras competências existentes pra aplicar o excedente (SPEC §13). Por isso o formulário de pagamento sempre lista competências reais e pede um valor por competência selecionada, nunca um valor único auto-distribuído.
- Nenhuma exclusão física de `pagamentos`/`mensalidades`/`pagamento_mensalidades` — cancelamento é `status = CANCELADO` com motivo/usuário/data (já como constraint de banco na Fase 2).
- Inadimplência (SPEC §7): mais de 6 competências vencidas e não pagas (`status` PENDENTE/PARCIAL com competência no passado) = INATIVO; volta a ATIVO automaticamente quando regularizado.
- TypeScript estrito, sem `any` não justificado.

## Decisões confirmadas com o usuário (2026-08-11)

1. **Inadimplência conta membro remido normalmente** — não há exceção para remidos na contagem de competências vencidas.
2. **Membro com `do_quadro = false` é excluído do recálculo de situação** — sua `situacao` não é tocada quando ele não pertence mais ao quadro.
3. **Geração de competências em lote usa sempre a configuração vigente HOJE** — se várias competências forem geradas de uma vez para um membro (atraso no cadastro, backfill), todas usam o `config_mensalidade` mais recente no momento da geração, não um valor histórico por mês.
4. **Geração é acionada por botão manual** ("Gerar mensalidades" em `/mensalidades`) — não há job automático/cron nesta fase.

---

## Task 1: Domínio — geração de competências

**Files:**
- Create: `lib/domain/competencias.ts`
- Test: `lib/domain/competencias.test.ts`

**Interfaces:**
- Produces: `type Competencia = { ano: number; mes: number }`, `proximaCompetenciaAposCadastro(dataCadastro: string): Competencia`, `competenciasFaltantes(primeira: Competencia, ate: Competencia, existentes: Competencia[]): Competencia[]`.

- [ ] **Step 1: Escrever o teste que falha primeiro**

```typescript
// lib/domain/competencias.test.ts
import { describe, expect, it } from 'vitest'
import { competenciasFaltantes, proximaCompetenciaAposCadastro } from './competencias'

describe('proximaCompetenciaAposCadastro', () => {
  it('retorna o mês seguinte ao cadastro (SPEC: cadastro 15/08/2026 → primeira competência 09/2026)', () => {
    expect(proximaCompetenciaAposCadastro('2026-08-15')).toEqual({ ano: 2026, mes: 9 })
  })

  it('vira o ano quando o cadastro é em dezembro', () => {
    expect(proximaCompetenciaAposCadastro('2026-12-01')).toEqual({ ano: 2027, mes: 1 })
  })
})

describe('competenciasFaltantes', () => {
  it('não gera nada se a primeira competência ainda não chegou (cadastro no mês atual)', () => {
    const primeira = { ano: 2026, mes: 9 }
    const ate = { ano: 2026, mes: 8 }
    expect(competenciasFaltantes(primeira, ate, [])).toEqual([])
  })

  it('gera todas as competências entre a primeira e a atual quando não existe nenhuma', () => {
    const primeira = { ano: 2026, mes: 4 }
    const ate = { ano: 2026, mes: 6 }
    expect(competenciasFaltantes(primeira, ate, [])).toEqual([
      { ano: 2026, mes: 4 },
      { ano: 2026, mes: 5 },
      { ano: 2026, mes: 6 },
    ])
  })

  it('não repete competências já existentes', () => {
    const primeira = { ano: 2026, mes: 4 }
    const ate = { ano: 2026, mes: 6 }
    const existentes = [{ ano: 2026, mes: 5 }]
    expect(competenciasFaltantes(primeira, ate, existentes)).toEqual([
      { ano: 2026, mes: 4 },
      { ano: 2026, mes: 6 },
    ])
  })

  it('atravessa a virada de ano corretamente', () => {
    const primeira = { ano: 2026, mes: 11 }
    const ate = { ano: 2027, mes: 2 }
    expect(competenciasFaltantes(primeira, ate, [])).toEqual([
      { ano: 2026, mes: 11 },
      { ano: 2026, mes: 12 },
      { ano: 2027, mes: 1 },
      { ano: 2027, mes: 2 },
    ])
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run lib/domain/competencias.test.ts`
Expected: FAIL — `Cannot find module './competencias'`.

- [ ] **Step 3: Implementar `lib/domain/competencias.ts`**

```typescript
export type Competencia = { ano: number; mes: number }

/**
 * SPEC §10: o novo membro começa a gerar mensalidade no mês SEGUINTE ao
 * cadastro. Cadastro em 15/08/2026 → primeira competência 09/2026.
 */
export function proximaCompetenciaAposCadastro(dataCadastro: string): Competencia {
  const data = new Date(dataCadastro)
  const mes = data.getUTCMonth() + 1
  const ano = data.getUTCFullYear()

  if (mes === 12) {
    return { ano: ano + 1, mes: 1 }
  }

  return { ano, mes: mes + 1 }
}

function competenciaMenorOuIgual(a: Competencia, b: Competencia): boolean {
  if (a.ano !== b.ano) {
    return a.ano < b.ano
  }
  return a.mes <= b.mes
}

function proximaCompetencia(c: Competencia): Competencia {
  if (c.mes === 12) {
    return { ano: c.ano + 1, mes: 1 }
  }
  return { ano: c.ano, mes: c.mes + 1 }
}

function chave(c: Competencia): string {
  return `${c.ano}-${String(c.mes).padStart(2, '0')}`
}

/**
 * Lista as competências entre `primeira` e `ate` (inclusive) que ainda não
 * existem em `existentes`. Não gera nada se `primeira` for posterior a
 * `ate` (membro cadastrado neste mês — SPEC §10: "Agosto não deve gerar
 * cobrança").
 */
export function competenciasFaltantes(
  primeira: Competencia,
  ate: Competencia,
  existentes: Competencia[]
): Competencia[] {
  const existentesChaves = new Set(existentes.map(chave))
  const faltantes: Competencia[] = []
  let atual = primeira

  while (competenciaMenorOuIgual(atual, ate)) {
    if (!existentesChaves.has(chave(atual))) {
      faltantes.push(atual)
    }
    atual = proximaCompetencia(atual)
  }

  return faltantes
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run lib/domain/competencias.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/competencias.ts lib/domain/competencias.test.ts
git commit -m "feat: domínio de geração de competências com testes"
```

---

## Task 2: Domínio — inadimplência real

**Files:**
- Modify: `lib/domain/inadimplencia.ts` (já existe da Fase 5, contém `calcularSituacaoMembro`)
- Modify: `lib/domain/inadimplencia.test.ts` (já existe)

**Interfaces:**
- Consumes: `calcularSituacaoMembro` (já existe).
- Produces (novo, adicionado ao mesmo arquivo): `competenciaVencida(competencia: {ano: number; mes: number}, hoje: {ano: number; mes: number}): boolean`, `contarCompetenciasVencidasNaoPagas(mensalidades: {ano: number; mes: number; status: string}[], hoje: {ano: number; mes: number}): number`.

- [ ] **Step 1: Ler o arquivo atual antes de editar**

Ler `lib/domain/inadimplencia.ts` e `lib/domain/inadimplencia.test.ts` para não sobrescrever `calcularSituacaoMembro` e seus testes já existentes.

- [ ] **Step 2: Adicionar os novos testes ao final de `lib/domain/inadimplencia.test.ts`**

```typescript
// adicionar ao final de lib/domain/inadimplencia.test.ts, mantendo os describe/it já existentes
describe('competenciaVencida', () => {
  it('competência de mês anterior ao atual está vencida', () => {
    expect(competenciaVencida({ ano: 2026, mes: 6 }, { ano: 2026, mes: 8 })).toBe(true)
  })

  it('competência do mês atual não está vencida', () => {
    expect(competenciaVencida({ ano: 2026, mes: 8 }, { ano: 2026, mes: 8 })).toBe(false)
  })

  it('competência futura não está vencida', () => {
    expect(competenciaVencida({ ano: 2026, mes: 9 }, { ano: 2026, mes: 8 })).toBe(false)
  })

  it('considera o ano na comparação', () => {
    expect(competenciaVencida({ ano: 2025, mes: 12 }, { ano: 2026, mes: 1 })).toBe(true)
  })
})

describe('contarCompetenciasVencidasNaoPagas', () => {
  const hoje = { ano: 2026, mes: 8 }

  it('conta apenas PENDENTE/PARCIAL vencidas', () => {
    const mensalidades = [
      { ano: 2026, mes: 1, status: 'PENDENTE' },
      { ano: 2026, mes: 2, status: 'PARCIAL' },
      { ano: 2026, mes: 3, status: 'QUITADA' },
      { ano: 2026, mes: 4, status: 'CANCELADA' },
      { ano: 2026, mes: 5, status: 'NAO_APLICAVEL' },
      { ano: 2026, mes: 9, status: 'PENDENTE' }, // futura, não conta
    ]
    expect(contarCompetenciasVencidasNaoPagas(mensalidades, hoje)).toBe(2)
  })

  it('retorna 0 quando não há competências vencidas', () => {
    expect(contarCompetenciasVencidasNaoPagas([], hoje)).toBe(0)
  })
})
```

- [ ] **Step 3: Rodar e confirmar falha**

Run: `npx vitest run lib/domain/inadimplencia.test.ts`
Expected: FAIL — `competenciaVencida is not defined` (ou erro de import).

- [ ] **Step 4: Adicionar as funções ao final de `lib/domain/inadimplencia.ts`**

```typescript
// adicionar ao final de lib/domain/inadimplencia.ts, mantendo calcularSituacaoMembro já existente

export type CompetenciaSituacao = { ano: number; mes: number }

/** Vencida = competência de um mês/ano anterior ao mês/ano atual. */
export function competenciaVencida(competencia: CompetenciaSituacao, hoje: CompetenciaSituacao): boolean {
  if (competencia.ano !== hoje.ano) {
    return competencia.ano < hoje.ano
  }
  return competencia.mes < hoje.mes
}

/**
 * Conta competências PENDENTE ou PARCIAL cuja data já passou. CANCELADA e
 * NAO_APLICAVEL nunca contam (decisão registrada na Fase 1). Membros
 * remidos contam normalmente — não há exceção (decisão confirmada com o
 * usuário em 2026-08-11).
 */
export function contarCompetenciasVencidasNaoPagas(
  mensalidades: { ano: number; mes: number; status: string }[],
  hoje: CompetenciaSituacao
): number {
  return mensalidades.filter(
    (m) => (m.status === 'PENDENTE' || m.status === 'PARCIAL') && competenciaVencida(m, hoje)
  ).length
}
```

- [ ] **Step 5: Rodar e confirmar sucesso**

Run: `npx vitest run lib/domain/inadimplencia.test.ts`
Expected: PASS (todos os testes, os já existentes de `calcularSituacaoMembro` + os novos).

- [ ] **Step 6: Commit**

```bash
git add lib/domain/inadimplencia.ts lib/domain/inadimplencia.test.ts
git commit -m "feat: contagem real de competências vencidas para inadimplência"
```

---

## Task 3: Domínio — validação e alocação de pagamento

**Files:**
- Create: `lib/domain/pagamentos.ts`
- Test: `lib/domain/pagamentos.test.ts`

**Interfaces:**
- Produces: `type AlocacaoCompetencia = { mensalidadeId: string; valorAplicado: number }`, `type MensalidadeParaPagamento = { id: string; saldo: number }`, `validarAlocacoes(alocacoes: AlocacaoCompetencia[], mensalidades: MensalidadeParaPagamento[]): {valido: true} | {valido: false; erro: string}`, `calcularNovoStatusMensalidade(valorDevido: number, novoValorPago: number): 'PARCIAL' | 'QUITADA'`, `calcularValorTotal(alocacoes: AlocacaoCompetencia[]): number`.

- [ ] **Step 1: Escrever o teste que falha primeiro**

```typescript
// lib/domain/pagamentos.test.ts
import { describe, expect, it } from 'vitest'
import {
  calcularNovoStatusMensalidade,
  calcularValorTotal,
  validarAlocacoes,
} from './pagamentos'

describe('validarAlocacoes', () => {
  const mensalidades = [
    { id: 'm1', saldo: 150 },
    { id: 'm2', saldo: 100 },
  ]

  it('rejeita lista vazia', () => {
    expect(validarAlocacoes([], mensalidades)).toEqual({
      valido: false,
      erro: 'Selecione ao menos uma competência.',
    })
  })

  it('aceita uma alocação de valor igual ao saldo (pagamento integral)', () => {
    expect(validarAlocacoes([{ mensalidadeId: 'm1', valorAplicado: 150 }], mensalidades)).toEqual({
      valido: true,
    })
  })

  it('aceita uma alocação menor que o saldo (pagamento parcial)', () => {
    expect(validarAlocacoes([{ mensalidadeId: 'm1', valorAplicado: 100 }], mensalidades)).toEqual({
      valido: true,
    })
  })

  it('aceita múltiplas competências (pagamento de várias competências / acima do valor de uma)', () => {
    expect(
      validarAlocacoes(
        [
          { mensalidadeId: 'm1', valorAplicado: 150 },
          { mensalidadeId: 'm2', valorAplicado: 100 },
        ],
        mensalidades
      )
    ).toEqual({ valido: true })
  })

  it('rejeita valor zero ou negativo', () => {
    expect(validarAlocacoes([{ mensalidadeId: 'm1', valorAplicado: 0 }], mensalidades)).toEqual({
      valido: false,
      erro: 'Informe um valor válido para cada competência selecionada.',
    })
  })

  it('rejeita competência não encontrada na lista', () => {
    expect(validarAlocacoes([{ mensalidadeId: 'inexistente', valorAplicado: 50 }], mensalidades)).toEqual({
      valido: false,
      erro: 'Competência selecionada não encontrada.',
    })
  })

  it('rejeita valor aplicado maior que o saldo da competência (SPEC §13: não criar competência automaticamente)', () => {
    expect(validarAlocacoes([{ mensalidadeId: 'm1', valorAplicado: 200 }], mensalidades)).toEqual({
      valido: false,
      erro: 'O valor aplicado não pode ser maior que o saldo devido da competência.',
    })
  })
})

describe('calcularNovoStatusMensalidade', () => {
  it('retorna QUITADA quando o valor pago iguala o devido', () => {
    expect(calcularNovoStatusMensalidade(150, 150)).toBe('QUITADA')
  })

  it('retorna QUITADA quando o valor pago excede o devido (não deveria ocorrer, mas não deve travar)', () => {
    expect(calcularNovoStatusMensalidade(150, 160)).toBe('QUITADA')
  })

  it('retorna PARCIAL quando o valor pago é menor que o devido', () => {
    expect(calcularNovoStatusMensalidade(150, 100)).toBe('PARCIAL')
  })
})

describe('calcularValorTotal', () => {
  it('soma o valor aplicado de todas as alocações', () => {
    expect(
      calcularValorTotal([
        { mensalidadeId: 'm1', valorAplicado: 150 },
        { mensalidadeId: 'm2', valorAplicado: 100 },
      ])
    ).toBe(250)
  })

  it('retorna 0 para lista vazia', () => {
    expect(calcularValorTotal([])).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run lib/domain/pagamentos.test.ts`
Expected: FAIL — `Cannot find module './pagamentos'`.

- [ ] **Step 3: Implementar `lib/domain/pagamentos.ts`**

```typescript
export type AlocacaoCompetencia = { mensalidadeId: string; valorAplicado: number }
export type MensalidadeParaPagamento = { id: string; saldo: number }
export type ValidationResult = { valido: true } | { valido: false; erro: string }

/**
 * Valida as alocações de um pagamento contra o saldo real de cada
 * competência. Um valor maior que o saldo de uma competência é rejeitado —
 * SPEC §13: pagamento acima do valor de uma competência exige selecionar
 * OUTRAS competências existentes, nunca criar uma nova automaticamente.
 */
export function validarAlocacoes(
  alocacoes: AlocacaoCompetencia[],
  mensalidades: MensalidadeParaPagamento[]
): ValidationResult {
  if (alocacoes.length === 0) {
    return { valido: false, erro: 'Selecione ao menos uma competência.' }
  }

  for (const alocacao of alocacoes) {
    if (!Number.isFinite(alocacao.valorAplicado) || alocacao.valorAplicado <= 0) {
      return { valido: false, erro: 'Informe um valor válido para cada competência selecionada.' }
    }

    const mensalidade = mensalidades.find((m) => m.id === alocacao.mensalidadeId)
    if (!mensalidade) {
      return { valido: false, erro: 'Competência selecionada não encontrada.' }
    }

    if (alocacao.valorAplicado > mensalidade.saldo) {
      return {
        valido: false,
        erro: 'O valor aplicado não pode ser maior que o saldo devido da competência.',
      }
    }
  }

  return { valido: true }
}

/** SPEC §12: valor pago = devido → QUITADA; menor → PARCIAL. */
export function calcularNovoStatusMensalidade(
  valorDevido: number,
  novoValorPago: number
): 'PARCIAL' | 'QUITADA' {
  return novoValorPago >= valorDevido ? 'QUITADA' : 'PARCIAL'
}

export function calcularValorTotal(alocacoes: AlocacaoCompetencia[]): number {
  return alocacoes.reduce((soma, a) => soma + a.valorAplicado, 0)
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run lib/domain/pagamentos.test.ts`
Expected: PASS (12 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/pagamentos.ts lib/domain/pagamentos.test.ts
git commit -m "feat: domínio de validação e alocação de pagamento com testes"
```

---

## Task 4: Server Action — geração de competências + recálculo de situação

**Files:**
- Create: `lib/mensalidades/recalcular-situacao.ts`
- Create: `app/(app)/mensalidades/actions.ts`

**Interfaces:**
- Consumes: `requireTesoureiro`, `AuthorizationError` (`lib/auth/require-role.ts`), `createSupabaseServiceRoleClient` (`lib/supabase/service.ts`), `registrarAuditoria` (`lib/audit.ts`), `proximaCompetenciaAposCadastro`, `competenciasFaltantes`, `type Competencia` (Task 1), `calcularSituacaoMembro`, `contarCompetenciasVencidasNaoPagas` (Task 2).
- Produces: `recalcularSituacaoMembro(supabaseAdmin, membroId: string): Promise<void>` (usado também na Task 5), `gerarMensalidades(prevState, formData): Promise<{error:string}|{success:string}|undefined>`.

- [ ] **Step 1: Criar `lib/mensalidades/recalcular-situacao.ts`**

```typescript
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularSituacaoMembro, contarCompetenciasVencidasNaoPagas } from '@/lib/domain/inadimplencia'

/**
 * Recalcula e persiste a situação (ATIVO/INATIVO) de um membro com base
 * nas competências vencidas e não pagas. Membros fora do quadro
 * (do_quadro=false) são ignorados — decisão confirmada com o usuário em
 * 2026-08-11.
 */
export async function recalcularSituacaoMembro(
  supabaseAdmin: SupabaseClient,
  membroId: string
): Promise<void> {
  const { data: membro } = await supabaseAdmin
    .from('membros')
    .select('do_quadro, situacao')
    .eq('id', membroId)
    .single()

  if (!membro || !membro.do_quadro) {
    return
  }

  const { data: mensalidades } = await supabaseAdmin
    .from('mensalidades')
    .select('ano, mes, status')
    .eq('membro_id', membroId)

  const hoje = new Date()
  const competenciaAtual = { ano: hoje.getUTCFullYear(), mes: hoje.getUTCMonth() + 1 }

  const vencidasNaoPagas = contarCompetenciasVencidasNaoPagas(mensalidades ?? [], competenciaAtual)
  const novaSituacao = calcularSituacaoMembro(vencidasNaoPagas)

  if (novaSituacao !== membro.situacao) {
    await supabaseAdmin.from('membros').update({ situacao: novaSituacao }).eq('id', membroId)
  }
}
```

- [ ] **Step 2: Criar `app/(app)/mensalidades/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { competenciasFaltantes, proximaCompetenciaAposCadastro, type Competencia } from '@/lib/domain/competencias'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function gerarMensalidades(
  _prevState: ActionState,
  _formData: FormData
): Promise<ActionState> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const hoje = new Date()
  const competenciaAtual: Competencia = { ano: hoje.getUTCFullYear(), mes: hoje.getUTCMonth() + 1 }

  const { data: membros, error: membrosError } = await supabaseAdmin
    .from('membros')
    .select('id, remido, data_cadastro')
    .eq('do_quadro', true)

  if (membrosError) {
    return { error: `Falha ao buscar membros: ${membrosError.message}` }
  }

  const { data: configNormal } = await supabaseAdmin
    .from('config_mensalidade')
    .select('valor_mensalidade, valor_grande_loja, valor_loja')
    .eq('tipo', 'NORMAL')
    .order('vigente_desde', { ascending: false })
    .limit(1)
    .single()

  const { data: configRemido } = await supabaseAdmin
    .from('config_mensalidade')
    .select('valor_mensalidade, valor_grande_loja, valor_loja')
    .eq('tipo', 'REMIDO')
    .order('vigente_desde', { ascending: false })
    .limit(1)
    .single()

  let totalGeradas = 0
  let membrosSemConfig = 0

  for (const membro of membros ?? []) {
    const config = membro.remido ? configRemido : configNormal
    if (!config) {
      membrosSemConfig += 1
      continue
    }

    const primeira = proximaCompetenciaAposCadastro(membro.data_cadastro)

    const { data: existentes } = await supabaseAdmin
      .from('mensalidades')
      .select('ano, mes')
      .eq('membro_id', membro.id)

    const faltantes = competenciasFaltantes(primeira, competenciaAtual, existentes ?? [])

    if (faltantes.length === 0) {
      continue
    }

    const novasLinhas = faltantes.map((competencia) => ({
      membro_id: membro.id,
      ano: competencia.ano,
      mes: competencia.mes,
      valor_devido: config.valor_mensalidade,
      valor_grande_loja: config.valor_grande_loja,
      valor_loja: config.valor_loja,
    }))

    const { error: insertError } = await supabaseAdmin.from('mensalidades').insert(novasLinhas)

    if (insertError) {
      return {
        error: `Falha ao gerar competências para o membro ${membro.id}: ${insertError.message}`,
      }
    }

    totalGeradas += novasLinhas.length
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'mensalidades',
      acao: 'GERACAO_COMPETENCIAS',
      descricao: `Geração de ${totalGeradas} competência(s) pendente(s)${
        membrosSemConfig > 0 ? ` (${membrosSemConfig} membro(s) sem configuração de mensalidade cadastrada, ignorados)` : ''
      }`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (competências geradas com sucesso):', auditError)
  }

  revalidatePath('/mensalidades')

  if (membrosSemConfig > 0) {
    return {
      success: `${totalGeradas} competência(s) gerada(s). ${membrosSemConfig} membro(s) ignorado(s) por falta de configuração de mensalidade (cadastre em Configurações → Mensalidades/Remidos).`,
    }
  }

  return { success: `${totalGeradas} competência(s) gerada(s) com sucesso.` }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add lib/mensalidades/recalcular-situacao.ts "app/(app)/mensalidades/actions.ts"
git commit -m "feat: Server Action de geração de mensalidades e recálculo de situação"
```

---

## Task 5: Server Actions — registrar e cancelar pagamento

**Files:**
- Create: `app/(app)/mensalidades/pagamento/actions.ts`

**Interfaces:**
- Consumes: `requireTesoureiro`, `AuthorizationError`, `createSupabaseServiceRoleClient`, `registrarAuditoria`, `validarAlocacoes`, `calcularNovoStatusMensalidade`, `calcularValorTotal`, `type AlocacaoCompetencia` (Task 3), `recalcularSituacaoMembro` (Task 4).
- Produces: `registrarPagamento(prevState, formData): Promise<{error:string}|{success:string}|undefined>`, `cancelarPagamento(pagamentoId: string, motivo: string): Promise<{error?: string}>`.

- [ ] **Step 1: Criar `app/(app)/mensalidades/pagamento/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import {
  calcularNovoStatusMensalidade,
  calcularValorTotal,
  validarAlocacoes,
  type AlocacaoCompetencia,
} from '@/lib/domain/pagamentos'
import { recalcularSituacaoMembro } from '@/lib/mensalidades/recalcular-situacao'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function registrarPagamento(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const membroId = String(formData.get('membroId') ?? '')
  const dataPagamento = String(formData.get('dataPagamento') ?? '')
  const contaId = String(formData.get('contaId') ?? '')
  const formaPagamentoId = String(formData.get('formaPagamentoId') ?? '')
  const observacao = String(formData.get('observacao') ?? '')

  if (!membroId || !dataPagamento || !contaId || !formaPagamentoId) {
    return { error: 'Preencha membro, data, conta e forma de pagamento.' }
  }

  const mensalidadeIds = formData.getAll('mensalidadeId').map(String)
  const alocacoes: AlocacaoCompetencia[] = mensalidadeIds
    .filter((id) => formData.get(`selecionada_${id}`) === 'on')
    .map((id) => ({
      mensalidadeId: id,
      valorAplicado: Number(formData.get(`valorAplicado_${id}`)),
    }))

  const supabaseAdmin = createSupabaseServiceRoleClient()

  if (alocacoes.length === 0) {
    return { error: 'Selecione ao menos uma competência.' }
  }

  const { data: mensalidades, error: mensalidadesError } = await supabaseAdmin
    .from('mensalidades')
    .select('id, valor_devido, valor_pago, saldo')
    .in(
      'id',
      alocacoes.map((a) => a.mensalidadeId)
    )

  if (mensalidadesError || !mensalidades) {
    return {
      error: `Falha ao carregar competências: ${mensalidadesError?.message ?? 'erro desconhecido'}`,
    }
  }

  const validacao = validarAlocacoes(
    alocacoes,
    mensalidades.map((m) => ({ id: m.id, saldo: m.saldo }))
  )
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const valorTotal = calcularValorTotal(alocacoes)

  const { data: pagamento, error: pagamentoError } = await supabaseAdmin
    .from('pagamentos')
    .insert({
      membro_id: membroId,
      valor_total: valorTotal,
      data_pagamento: dataPagamento,
      conta_id: contaId,
      forma_pagamento_id: formaPagamentoId,
      usuario_id: usuario.id,
      observacao: observacao.trim() || null,
    })
    .select('id')
    .single()

  if (pagamentoError || !pagamento) {
    return {
      error: `Falha ao registrar pagamento: ${pagamentoError?.message ?? 'erro desconhecido'}`,
    }
  }

  for (const alocacao of alocacoes) {
    const mensalidade = mensalidades.find((m) => m.id === alocacao.mensalidadeId)
    if (!mensalidade) {
      continue
    }

    const { error: linkError } = await supabaseAdmin.from('pagamento_mensalidades').insert({
      pagamento_id: pagamento.id,
      mensalidade_id: alocacao.mensalidadeId,
      valor_aplicado: alocacao.valorAplicado,
    })

    if (linkError) {
      return { error: `Falha ao vincular competência ao pagamento: ${linkError.message}` }
    }

    const novoValorPago = mensalidade.valor_pago + alocacao.valorAplicado
    const novoStatus = calcularNovoStatusMensalidade(mensalidade.valor_devido, novoValorPago)

    const { error: updateError } = await supabaseAdmin
      .from('mensalidades')
      .update({
        valor_pago: novoValorPago,
        status: novoStatus,
        data_quitacao: novoStatus === 'QUITADA' ? new Date().toISOString() : null,
      })
      .eq('id', alocacao.mensalidadeId)

    if (updateError) {
      return { error: `Falha ao atualizar competência: ${updateError.message}` }
    }
  }

  await recalcularSituacaoMembro(supabaseAdmin, membroId)

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'mensalidades',
      acao: 'PAGAMENTO',
      registroTabela: 'pagamentos',
      registroId: pagamento.id,
      dadosNovos: { membroId, valorTotal, alocacoes },
      descricao: `Pagamento de ${alocacoes.length} competência(s) do membro ${membroId}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (pagamento registrado com sucesso):', auditError)
  }

  revalidatePath('/mensalidades')
  revalidatePath('/mensalidades/pagamento')
  revalidatePath(`/membros/${membroId}`)
  return { success: 'Pagamento registrado com sucesso.' }
}

export async function cancelarPagamento(pagamentoId: string, motivo: string): Promise<{ error?: string }> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  if (motivo.trim().length === 0) {
    return { error: 'Informe o motivo do cancelamento.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: pagamento, error: pagamentoError } = await supabaseAdmin
    .from('pagamentos')
    .select('id, membro_id, status')
    .eq('id', pagamentoId)
    .single()

  if (pagamentoError || !pagamento) {
    return { error: 'Pagamento não encontrado.' }
  }

  if (pagamento.status === 'CANCELADO') {
    return { error: 'Este pagamento já está cancelado.' }
  }

  const { data: vinculos, error: vinculosError } = await supabaseAdmin
    .from('pagamento_mensalidades')
    .select('mensalidade_id, valor_aplicado')
    .eq('pagamento_id', pagamentoId)

  if (vinculosError || !vinculos) {
    return {
      error: `Falha ao carregar competências vinculadas: ${vinculosError?.message ?? 'erro desconhecido'}`,
    }
  }

  for (const vinculo of vinculos) {
    const { data: mensalidade } = await supabaseAdmin
      .from('mensalidades')
      .select('valor_devido, valor_pago')
      .eq('id', vinculo.mensalidade_id)
      .single()

    if (!mensalidade) {
      continue
    }

    const novoValorPago = Math.max(0, mensalidade.valor_pago - vinculo.valor_aplicado)
    const novoStatus =
      novoValorPago === 0 ? 'PENDENTE' : calcularNovoStatusMensalidade(mensalidade.valor_devido, novoValorPago)

    const updatePayload: Record<string, unknown> = { valor_pago: novoValorPago, status: novoStatus }
    if (novoStatus !== 'QUITADA') {
      updatePayload.data_quitacao = null
    }

    const { error: updateError } = await supabaseAdmin
      .from('mensalidades')
      .update(updatePayload)
      .eq('id', vinculo.mensalidade_id)

    if (updateError) {
      return { error: `Falha ao reverter competência: ${updateError.message}` }
    }
  }

  const { error: cancelError } = await supabaseAdmin
    .from('pagamentos')
    .update({
      status: 'CANCELADO',
      motivo_cancelamento: motivo.trim(),
      cancelado_por: usuario.id,
      cancelado_em: new Date().toISOString(),
    })
    .eq('id', pagamentoId)

  if (cancelError) {
    return { error: `Falha ao cancelar pagamento: ${cancelError.message}` }
  }

  await recalcularSituacaoMembro(supabaseAdmin, pagamento.membro_id)

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'mensalidades',
      acao: 'CANCELAMENTO_PAGAMENTO',
      registroTabela: 'pagamentos',
      registroId: pagamentoId,
      dadosNovos: { motivo: motivo.trim() },
      descricao: `Cancelamento do pagamento ${pagamentoId}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (pagamento cancelado com sucesso):', auditError)
  }

  revalidatePath('/mensalidades')
  revalidatePath('/mensalidades/pagamento')
  revalidatePath(`/membros/${pagamento.membro_id}`)
  return {}
}
```

Nota: se a mesma competência ainda estiver QUITADA após o cancelamento (caso raro de dois pagamentos distintos cobrindo a mesma competência), `data_quitacao` original é preservada — o payload de update só inclui `data_quitacao` quando o novo status não é QUITADA.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/mensalidades/pagamento/actions.ts"
git commit -m "feat: Server Actions de registro e cancelamento de pagamento"
```

---

## Task 6: UI — tela de mensalidades (grade anual + geração)

**Files:**
- Create: `app/(app)/mensalidades/GerarMensalidadesButton.tsx`
- Create: `app/(app)/mensalidades/page.tsx`

**Interfaces:**
- Consumes: `gerarMensalidades` (Task 4), `createSupabaseServerClient`, `AcessoNegado`.

- [ ] **Step 1: Criar `app/(app)/mensalidades/GerarMensalidadesButton.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { gerarMensalidades } from './actions'

export function GerarMensalidadesButton() {
  const [state, formAction, pending] = useActionState(gerarMensalidades, undefined)

  return (
    <form action={formAction} className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
      >
        {pending ? 'Gerando...' : 'Gerar mensalidades'}
      </button>
      {state && 'error' in state && (
        <span className="text-sm text-red-600" role="alert">
          {state.error}
        </span>
      )}
      {state && 'success' in state && (
        <span className="text-sm text-green-700" role="status">
          {state.success}
        </span>
      )}
    </form>
  )
}
```

- [ ] **Step 2: Criar `app/(app)/mensalidades/page.tsx`**

```tsx
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { GerarMensalidadesButton } from './GerarMensalidadesButton'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function corStatus(status: string | undefined): string {
  switch (status) {
    case 'QUITADA':
      return 'bg-green-100 text-green-800'
    case 'PARCIAL':
      return 'bg-amber-100 text-amber-800'
    case 'PENDENTE':
      return 'bg-red-100 text-red-800'
    case 'CANCELADA':
      return 'bg-slate-100 text-slate-400'
    default:
      return 'bg-slate-50 text-slate-300'
  }
}

export default async function MensalidadesPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>
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
  const podeGerenciar = profile?.role === 'ADMINISTRADOR' || profile?.role === 'TESOUREIRO'

  const anoSelecionado = params.ano ? Number(params.ano) : new Date().getFullYear()

  const { data: membros } = await supabase
    .from('membros')
    .select('id, nome')
    .eq('do_quadro', true)
    .order('nome')

  const { data: mensalidades, error } = await supabase
    .from('mensalidades')
    .select('membro_id, mes, status')
    .eq('ano', anoSelecionado)

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar mensalidades: {error.message}
      </div>
    )
  }

  const statusPorMembroMes = new Map<string, string>()
  for (const m of mensalidades ?? []) {
    statusPorMembroMes.set(`${m.membro_id}-${m.mes}`, m.status)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Mensalidades — {anoSelecionado}</h1>
        <div className="flex items-center gap-3">
          {podeGerenciar && (
            <Link
              href="/mensalidades/pagamento"
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Registrar pagamento
            </Link>
          )}
          {podeGerenciar && <GerarMensalidadesButton />}
        </div>
      </div>

      <form className="flex gap-3">
        <select
          name="ano"
          defaultValue={String(anoSelecionado)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {[anoSelecionado - 1, anoSelecionado, anoSelecionado + 1].map((ano) => (
            <option key={ano} value={ano}>
              {ano}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700">
          Ver ano
        </button>
      </form>

      {!membros || membros.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum membro do quadro cadastrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Membro</th>
                {MESES.map((mes) => (
                  <th key={mes} className="px-2 py-2 text-center font-medium">
                    {mes}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {membros.map((membro) => (
                <tr key={membro.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-medium text-slate-900">{membro.nome}</td>
                  {MESES.map((_, index) => {
                    const status = statusPorMembroMes.get(`${membro.id}-${index + 1}`)
                    return (
                      <td key={index} className="px-2 py-2 text-center">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs ${corStatus(status)}`}>
                          {status ? status.slice(0, 3) : '—'}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/mensalidades/GerarMensalidadesButton.tsx" "app/(app)/mensalidades/page.tsx"
git commit -m "feat: tela de mensalidades com grade anual e geração de competências"
```

---

## Task 7: UI — tela de registro/cancelamento de pagamento

**Files:**
- Create: `app/(app)/mensalidades/pagamento/SelecionarMembro.tsx`
- Create: `app/(app)/mensalidades/pagamento/PagamentoForm.tsx`
- Create: `app/(app)/mensalidades/pagamento/HistoricoPagamentos.tsx`
- Create: `app/(app)/mensalidades/pagamento/page.tsx`

**Interfaces:**
- Consumes: `registrarPagamento`, `cancelarPagamento` (Task 5), `createSupabaseServerClient`, `AcessoNegado`.

- [ ] **Step 1: Criar `app/(app)/mensalidades/pagamento/SelecionarMembro.tsx`**

```tsx
export function SelecionarMembro({
  membros,
  membroSelecionado,
}: {
  membros: { id: string; nome: string }[]
  membroSelecionado?: string
}) {
  return (
    <form className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <select
        name="membroId"
        defaultValue={membroSelecionado ?? ''}
        className="rounded border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Selecione um membro</option>
        {membros.map((membro) => (
          <option key={membro.id} value={membro.id}>
            {membro.nome}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700">
        Selecionar
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Criar `app/(app)/mensalidades/pagamento/PagamentoForm.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { registrarPagamento } from './actions'

type Competencia = {
  id: string
  ano: number
  mes: number
  valor_devido: number
  valor_pago: number
  saldo: number
  status: string
}

export function PagamentoForm({
  membroId,
  competencias,
  contas,
  formasPagamento,
}: {
  membroId: string
  competencias: Competencia[]
  contas: { id: string; nome: string }[]
  formasPagamento: { id: string; nome: string }[]
}) {
  const [state, formAction, pending] = useActionState(registrarPagamento, undefined)

  if (competencias.length === 0) {
    return <p className="text-sm text-slate-500">Este membro não possui competências pendentes.</p>
  }

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <input type="hidden" name="membroId" value={membroId} />

      <table className="w-full text-sm">
        <thead className="text-left text-slate-500">
          <tr>
            <th className="py-2"></th>
            <th className="py-2">Competência</th>
            <th className="py-2">Devido</th>
            <th className="py-2">Saldo</th>
            <th className="py-2">Valor a aplicar</th>
          </tr>
        </thead>
        <tbody>
          {competencias.map((c) => (
            <tr key={c.id} className="border-t border-slate-100">
              <td className="py-2">
                <input type="checkbox" name={`selecionada_${c.id}`} />
                <input type="hidden" name="mensalidadeId" value={c.id} />
              </td>
              <td className="py-2">
                {String(c.mes).padStart(2, '0')}/{c.ano}
              </td>
              <td className="py-2">
                {c.valor_devido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
              <td className="py-2">{c.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              <td className="py-2">
                <input
                  type="number"
                  step="0.01"
                  name={`valorAplicado_${c.id}`}
                  defaultValue={c.saldo}
                  className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="dataPagamento" className="text-sm font-medium text-slate-700">
            Data do pagamento
          </label>
          <input
            id="dataPagamento"
            name="dataPagamento"
            type="date"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="contaId" className="text-sm font-medium text-slate-700">
            Conta
          </label>
          <select id="contaId" name="contaId" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
            <option value="">Selecione</option>
            {contas.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="formaPagamentoId" className="text-sm font-medium text-slate-700">
            Forma de pagamento
          </label>
          <select
            id="formaPagamentoId"
            name="formaPagamentoId"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Selecione</option>
            {formasPagamento.map((forma) => (
              <option key={forma.id} value={forma.id}>
                {forma.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="observacao" className="text-sm font-medium text-slate-700">
          Observação (opcional)
        </label>
        <input
          id="observacao"
          name="observacao"
          type="text"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
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
        {pending ? 'Registrando...' : 'Confirmar pagamento'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Criar `app/(app)/mensalidades/pagamento/HistoricoPagamentos.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { cancelarPagamento } from './actions'

type Pagamento = {
  id: string
  valor_total: number
  data_pagamento: string
  status: string
  motivo_cancelamento: string | null
}

export function HistoricoPagamentos({ pagamentos }: { pagamentos: Pagamento[] }) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ id: string; message: string; isError: boolean } | null>(null)

  function handleCancelar(pagamento: Pagamento) {
    const motivo = window.prompt(`Motivo do cancelamento do pagamento de ${new Date(pagamento.data_pagamento).toLocaleDateString('pt-BR')}:`)
    if (!motivo) {
      return
    }

    startTransition(async () => {
      const result = await cancelarPagamento(pagamento.id, motivo)
      setFeedback({
        id: pagamento.id,
        message: result.error ?? 'Pagamento cancelado.',
        isError: Boolean(result.error),
      })
    })
  }

  if (pagamentos.length === 0) {
    return null
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Data</th>
            <th className="px-4 py-2 font-medium">Valor total</th>
            <th className="px-4 py-2 font-medium">Situação</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {pagamentos.map((pagamento) => (
            <tr key={pagamento.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2">{new Date(pagamento.data_pagamento).toLocaleDateString('pt-BR')}</td>
              <td className="px-4 py-2">
                {pagamento.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
              <td className="px-4 py-2">
                <span className={pagamento.status === 'ATIVO' ? 'text-green-700' : 'text-slate-400'}>
                  {pagamento.status}
                </span>
              </td>
              <td className="px-4 py-2">
                {pagamento.status === 'ATIVO' && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleCancelar(pagamento)}
                    className="text-slate-700 underline disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {feedback && (
        <p
          className={`px-4 py-2 text-sm ${feedback.isError ? 'text-red-600' : 'text-green-700'}`}
          role={feedback.isError ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Criar `app/(app)/mensalidades/pagamento/page.tsx`**

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { SelecionarMembro } from './SelecionarMembro'
import { PagamentoForm } from './PagamentoForm'
import { HistoricoPagamentos } from './HistoricoPagamentos'

export default async function PagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ membroId?: string }>
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
  if (profile?.role !== 'ADMINISTRADOR' && profile?.role !== 'TESOUREIRO') {
    return <AcessoNegado />
  }

  const { data: membros } = await supabase.from('membros').select('id, nome').eq('do_quadro', true).order('nome')
  const { data: contas } = await supabase.from('contas').select('id, nome').eq('ativo', true).order('nome')
  const { data: formasPagamento } = await supabase
    .from('formas_pagamento')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')

  let competencias: {
    id: string
    ano: number
    mes: number
    valor_devido: number
    valor_pago: number
    saldo: number
    status: string
  }[] = []
  let pagamentos: {
    id: string
    valor_total: number
    data_pagamento: string
    status: string
    motivo_cancelamento: string | null
  }[] = []

  if (params.membroId) {
    const { data: competenciasData } = await supabase
      .from('mensalidades')
      .select('id, ano, mes, valor_devido, valor_pago, saldo, status')
      .eq('membro_id', params.membroId)
      .in('status', ['PENDENTE', 'PARCIAL'])
      .order('ano')
      .order('mes')
    competencias = competenciasData ?? []

    const { data: pagamentosData } = await supabase
      .from('pagamentos')
      .select('id, valor_total, data_pagamento, status, motivo_cancelamento')
      .eq('membro_id', params.membroId)
      .order('data_pagamento', { ascending: false })
    pagamentos = pagamentosData ?? []
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Registrar pagamento</h1>
      <SelecionarMembro membros={membros ?? []} membroSelecionado={params.membroId} />
      {params.membroId && (
        <>
          <PagamentoForm
            membroId={params.membroId}
            competencias={competencias}
            contas={contas ?? []}
            formasPagamento={formasPagamento ?? []}
          />
          <HistoricoPagamentos pagamentos={pagamentos} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Typecheck, lint e build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/mensalidades/pagamento"
git commit -m "feat: tela de registro e cancelamento de pagamento de mensalidade"
```

---

## Task 8: Checagem final

**Files:**
- Modify: `docs/arquitetura.md` (árvore de pastas)

- [ ] **Step 1: Atualizar `docs/arquitetura.md`**

Adicionar à árvore: `lib/domain/competencias.ts` (+test), `lib/domain/pagamentos.ts` (+test), as adições em `lib/domain/inadimplencia.ts`, `lib/mensalidades/recalcular-situacao.ts`, `app/(app)/mensalidades/{actions.ts,page.tsx,GerarMensalidadesButton.tsx,pagamento/*}`.

- [ ] **Step 2: Checagem final**

```bash
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add docs/arquitetura.md
git commit -m "docs: atualiza arquitetura com módulo de mensalidades"
```

---

## Self-Review (spec coverage)

- Geração de competências, mês seguinte ao cadastro — SPEC §10 → Task 1, 4. ✅
- Cada competência preserva membro/ano/mês/valores/status/data de quitação — já modelado na Fase 2, esta fase só grava. ✅
- Pagamento integral, parcial, múltiplas competências, atrasadas, acima do valor de uma competência — SPEC §11-13 → Task 3, 5, 7 (alocação explícita por competência, sem auto-criar competência). ✅
- Rateio preservado — SPEC §14 → nenhuma lógica nova necessária, snapshot já existe desde a Fase 2. ✅
- Regra crítica Grande Loja (competência ≠ data do pagamento) — SPEC §15 → cada `pagamento_mensalidades` vincula o pagamento (com sua data) à competência (com seu ano/mês) sem jamais substituir um pelo outro. ✅
- Inadimplência real (>6 vencidas = INATIVO, reativação automática) — SPEC §7 → Task 2, 4 (`recalcularSituacaoMembro` chamado após todo pagamento/cancelamento). ✅
- Cancelamento sem delete físico — SPEC §23 → Task 5 (`cancelarPagamento`, reverte `valor_pago`/`status` das competências, nunca apaga linha). ✅
- Auditoria de pagamento/cancelamento — CLAUDE.md §12 → Tasks 4, 5. ✅
- Fora de escopo (deliberado): relatório Grande Loja (Fase 9), fechamento mensal (Fase 7), recibos em PDF (Fase 10) — a criação de itens de `repasses_grande_loja_itens` continua não conectada, conforme decisão já registrada na Fase 2.

## Pendência conhecida

Testado manualmente pelo usuário contra o Supabase real, incluindo cenários de pagamento parcial, múltiplas competências e cancelamento — não faço teste de navegador nesta fase.
