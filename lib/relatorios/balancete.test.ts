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
    expect(resultado.linhas[1][4]).toBe((150).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
    expect(resultado.linhas[2][0]).toBe('— Pagamento João')
    expect(resultado.linhas[3][0]).toBe('— Pagamento Maria')
  })

  it('inclui o resumo com entradas, saídas e saldo do período', () => {
    const balancete = agruparMovimentacoesEmBalancete([mov({ valor: 300 })])
    const resultado = balanceteParaResultado(balancete)

    expect(resultado.resumo).toEqual([
      { label: 'Entradas', valor: (300).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
      { label: 'Saídas', valor: (0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
      { label: 'Saldo do período', valor: (300).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
    ])
  })

  it('não gera nenhuma linha quando não há movimentações', () => {
    const resultado = balanceteParaResultado(agruparMovimentacoesEmBalancete([]))
    expect(resultado.linhas).toEqual([])
  })
})
