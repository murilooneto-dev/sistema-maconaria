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

  it('categorias com mesmo nome mas tipos diferentes (ENTRADA e SAIDA) não são mescladas', () => {
    const centros = [
      centro({
        movimentacoes: [
          { id: 'm1', data: '2026-08-10', categoria: 'Eventos', descricao: 'Venda de ingressos', valor: 200, tipo: 'ENTRADA' },
          { id: 'm2', data: '2026-08-11', categoria: 'Eventos', descricao: 'Aluguel de espaço', valor: 80, tipo: 'SAIDA' },
        ],
      }),
    ]

    const [detalhado] = detalharCentrosDeCusto(centros)

    expect(detalhado.categorias).toHaveLength(2)

    const entrada = detalhado.categorias.find((c) => c.nome === 'Eventos' && c.tipo === 'ENTRADA')!
    expect(entrada).toBeDefined()
    expect(entrada.total).toBe(200)
    expect(entrada.lancamentos).toHaveLength(1)

    const saida = detalhado.categorias.find((c) => c.nome === 'Eventos' && c.tipo === 'SAIDA')!
    expect(saida).toBeDefined()
    expect(saida.total).toBe(80)
    expect(saida.lancamentos).toHaveLength(1)
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
    expect(linhaLancamento[2]).toBe(`+${formatarMoedaBR(100)}`)
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
