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

  it('roteia para "Sem centro de custo" uma categoria cujo único vínculo era com um centro desativado (contrato do fetch wrapper: vinculos nunca referenciam um id fora de `centros`)', () => {
    // O fetch wrapper (buscarDadosCentrosDeCusto) filtra `vinculos` para conter apenas ids presentes
    // em `centros` (que já veio filtrado por `ativo = true`) ANTES de chamar esta função pura. Então,
    // quando o único centro vinculado a uma categoria foi desativado, essa categoria chega aqui sem
    // NENHUM vínculo — exatamente como uma categoria que nunca teve vínculo algum — e cai no mesmo
    // caminho existente de "Sem centro de custo", em vez de ser silenciosamente descartada.
    const resultado = agruparMovimentacoesPorCentroDeCusto(
      [mov({ valor: 90, categorias_movimentacao: { id: 'cat-doacao', nome: 'Doação' } })],
      [{ id: 'centro-1', nome: 'Administrativo', cor: '#000000' }],
      []
    )

    const semCentro = resultado.find((c) => c.id === SEM_CENTRO_ID)
    expect(semCentro).toBeDefined()
    expect(semCentro!.totalEntradas).toBe(90)
    expect(resultado.find((c) => c.id === 'centro-1')!.totalEntradas).toBe(0)
  })
})
