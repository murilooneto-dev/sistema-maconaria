import { describe, expect, it } from 'vitest'
import {
  parseEmailsLembrete,
  contaVencida,
  deveEnviarLembrete,
  gerarVencimentosRecorrentes,
  separarParaLembrete,
  somarDias,
  tipoMovimentacaoDaConta,
  validarBaixa,
  validarNovaConta,
} from './contas-pagar-receber'

describe('gerarVencimentosRecorrentes', () => {
  it('gera um vencimento por mês no mesmo dia', () => {
    expect(gerarVencimentosRecorrentes('2026-10-10', 3)).toEqual(['2026-10-10', '2026-11-10', '2026-12-10'])
  })

  it('atravessa a virada de ano', () => {
    expect(gerarVencimentosRecorrentes('2026-11-05', 4)).toEqual([
      '2026-11-05',
      '2026-12-05',
      '2027-01-05',
      '2027-02-05',
    ])
  })

  it('usa o último dia quando o mês não tem o dia do vencimento, e volta ao dia original depois', () => {
    expect(gerarVencimentosRecorrentes('2027-01-31', 4)).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
    ])
  })

  it('respeita 29 de fevereiro em ano bissexto', () => {
    expect(gerarVencimentosRecorrentes('2028-01-30', 2)).toEqual(['2028-01-30', '2028-02-29'])
  })
})

describe('validarNovaConta', () => {
  const base = { tipo: 'PAGAR', nome: 'Energia', valor: 150, dataVencimento: '2026-10-20', recorrente: false, meses: 0 }

  it('aceita conta simples válida', () => {
    expect(validarNovaConta(base)).toEqual({ valido: true })
  })

  it('aceita conta recorrente com quantidade de meses', () => {
    expect(validarNovaConta({ ...base, recorrente: true, meses: 12 })).toEqual({ valido: true })
  })

  it('rejeita tipo inválido, nome vazio, valor zero/negativo e data inválida', () => {
    expect(validarNovaConta({ ...base, tipo: 'OUTRO' }).valido).toBe(false)
    expect(validarNovaConta({ ...base, nome: '  ' }).valido).toBe(false)
    expect(validarNovaConta({ ...base, valor: 0 }).valido).toBe(false)
    expect(validarNovaConta({ ...base, valor: -5 }).valido).toBe(false)
    expect(validarNovaConta({ ...base, valor: Number.NaN }).valido).toBe(false)
    expect(validarNovaConta({ ...base, dataVencimento: '' }).valido).toBe(false)
    expect(validarNovaConta({ ...base, dataVencimento: '2026-02-30' }).valido).toBe(false)
  })

  it('rejeita recorrência sem meses, com 1 mês, fracionada ou acima do limite', () => {
    expect(validarNovaConta({ ...base, recorrente: true, meses: 0 }).valido).toBe(false)
    expect(validarNovaConta({ ...base, recorrente: true, meses: 1 }).valido).toBe(false)
    expect(validarNovaConta({ ...base, recorrente: true, meses: 2.5 }).valido).toBe(false)
    expect(validarNovaConta({ ...base, recorrente: true, meses: 61 }).valido).toBe(false)
  })

  it('ignora o campo de meses quando a conta não é recorrente', () => {
    expect(validarNovaConta({ ...base, recorrente: false, meses: 999 })).toEqual({ valido: true })
  })
})

describe('validarBaixa', () => {
  const base = { dataBaixa: '2026-10-20', valorBaixa: 150, contaId: 'c', formaPagamentoId: 'f', categoriaId: 'k' }

  it('aceita baixa completa', () => {
    expect(validarBaixa(base)).toEqual({ valido: true })
  })

  it('rejeita cada campo obrigatório faltando', () => {
    expect(validarBaixa({ ...base, dataBaixa: '' }).valido).toBe(false)
    expect(validarBaixa({ ...base, valorBaixa: 0 }).valido).toBe(false)
    expect(validarBaixa({ ...base, contaId: '' }).valido).toBe(false)
    expect(validarBaixa({ ...base, formaPagamentoId: '' }).valido).toBe(false)
    expect(validarBaixa({ ...base, categoriaId: '' }).valido).toBe(false)
  })
})

describe('tipoMovimentacaoDaConta', () => {
  it('conta a pagar vira saída e a receber vira entrada', () => {
    expect(tipoMovimentacaoDaConta('PAGAR')).toBe('SAIDA')
    expect(tipoMovimentacaoDaConta('RECEBER')).toBe('ENTRADA')
  })
})

describe('contaVencida', () => {
  it('só conta ABERTA com vencimento anterior a hoje é vencida', () => {
    expect(contaVencida({ status: 'ABERTA', data_vencimento: '2026-10-08' }, '2026-10-09')).toBe(true)
    expect(contaVencida({ status: 'ABERTA', data_vencimento: '2026-10-09' }, '2026-10-09')).toBe(false)
    expect(contaVencida({ status: 'BAIXADA', data_vencimento: '2026-10-01' }, '2026-10-09')).toBe(false)
    expect(contaVencida({ status: 'CANCELADA', data_vencimento: '2026-10-01' }, '2026-10-09')).toBe(false)
  })
})

describe('lembrete de vencimento', () => {
  const hoje = '2026-10-09'
  const conta = (data_vencimento: string, status = 'ABERTA') => ({ data_vencimento, status })

  it('soma dias atravessando o mês', () => {
    expect(somarDias('2026-10-30', 3)).toBe('2026-11-02')
  })

  it('separa o que vence hoje, o que vence em 3 dias e o que já venceu', () => {
    const grupos = separarParaLembrete(
      [conta('2026-10-09'), conta('2026-10-12'), conta('2026-10-01'), conta('2026-10-11'), conta('2026-10-20')],
      hoje
    )
    expect(grupos.venceHoje).toEqual([conta('2026-10-09')])
    expect(grupos.venceEmBreve).toEqual([conta('2026-10-12')])
    expect(grupos.vencidas).toEqual([conta('2026-10-01')])
  })

  it('ignora contas baixadas e canceladas', () => {
    const grupos = separarParaLembrete([conta('2026-10-09', 'BAIXADA'), conta('2026-10-12', 'CANCELADA')], hoje)
    expect(grupos).toEqual({ venceHoje: [], venceEmBreve: [], vencidas: [] })
  })

  it('envia quando há conta vencendo hoje ou em breve, mas não só por haver vencidas', () => {
    expect(deveEnviarLembrete({ venceHoje: [1], venceEmBreve: [], vencidas: [] })).toBe(true)
    expect(deveEnviarLembrete({ venceHoje: [], venceEmBreve: [1], vencidas: [] })).toBe(true)
    expect(deveEnviarLembrete({ venceHoje: [], venceEmBreve: [], vencidas: [1, 2] })).toBe(false)
  })
})

describe('parseEmailsLembrete', () => {
  it('aceita e-mails por linha, vírgula ou ponto e vírgula, normaliza e remove repetidos', () => {
    expect(parseEmailsLembrete('Tesouraria@Loja.com.br\nfulano@gmail.com; tesouraria@loja.com.br, ')).toEqual({
      valido: true,
      emails: ['tesouraria@loja.com.br', 'fulano@gmail.com'],
    })
  })

  it('aceita lista vazia (volta ao padrão)', () => {
    expect(parseEmailsLembrete('  \n ')).toEqual({ valido: true, emails: [] })
  })

  it('rejeita e-mail malformado indicando qual', () => {
    expect(parseEmailsLembrete('ok@x.com, ruim@x')).toEqual({ valido: false, erro: 'E-mail inválido: ruim@x' })
  })

  it('rejeita mais de 10 e-mails', () => {
    const muitos = Array.from({ length: 11 }, (_, i) => `p${i}@x.com`).join(',')
    expect(parseEmailsLembrete(muitos).valido).toBe(false)
  })
})
