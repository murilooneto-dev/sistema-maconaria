import { describe, expect, it } from 'vitest'
import { montarEmailLembrete, type ContaLembrete } from './lembrete'

const conta = (dados: Partial<ContaLembrete>): ContaLembrete => ({
  tipo: 'PAGAR',
  nome: 'Energia',
  valor: 150,
  data_vencimento: '2026-10-09',
  status: 'ABERTA',
  parcela: null,
  total_parcelas: null,
  ...dados,
})

describe('montarEmailLembrete', () => {
  it('lista cada grupo e resume as quantidades no assunto', () => {
    const email = montarEmailLembrete(
      {
        venceHoje: [conta({})],
        venceEmBreve: [conta({ nome: 'Aluguel', tipo: 'RECEBER', data_vencimento: '2026-10-12', parcela: 2, total_parcelas: 12 })],
        vencidas: [conta({ nome: 'Água', data_vencimento: '2026-10-01' })],
      },
      'Loja Teste',
      'https://exemplo.com.br'
    )

    expect(email.assunto).toBe('Lembrete de vencimentos: 1 hoje e 1 em 3 dias')
    expect(email.texto).toContain('Vencem hoje\n- 09/10/2026 | A pagar | Energia |')
    expect(email.texto).toContain('- 12/10/2026 | A receber | Aluguel (2/12) |')
    expect(email.texto).toContain('Vencidas e ainda em aberto\n- 01/10/2026 | A pagar | Água |')
    expect(email.texto).toContain('https://exemplo.com.br/financeiro/contas-a-pagar')
    expect(email.html).toContain('Aluguel (2/12)')
  })

  it('omite os grupos vazios', () => {
    const email = montarEmailLembrete({ venceHoje: [conta({})], venceEmBreve: [], vencidas: [] }, 'Loja', 'https://x')
    expect(email.assunto).toBe('Lembrete de vencimentos: 1 hoje')
    expect(email.texto).not.toContain('Vencem em 3 dias')
    expect(email.texto).not.toContain('Vencidas')
  })

  it('escapa HTML no nome da conta e da Loja', () => {
    const email = montarEmailLembrete(
      { venceHoje: [conta({ nome: '<script>x</script>' })], venceEmBreve: [], vencidas: [] },
      'A & B',
      'https://x'
    )
    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;')
    expect(email.html).toContain('A &amp; B')
  })
})
