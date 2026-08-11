/**
 * Regra de inadimplência (SPEC §7): mais de 6 competências vencidas e não
 * pagas torna o membro INATIVO. Reativação para ATIVO é automática quando
 * o número volta a 6 ou menos. Esta função é pura — quem chama é
 * responsável por contar as competências vencidas (Fase 6, quando
 * mensalidades reais existirem).
 */
export function calcularSituacaoMembro(competenciasVencidasNaoPagas: number): 'ATIVO' | 'INATIVO' {
  return competenciasVencidasNaoPagas > 6 ? 'INATIVO' : 'ATIVO'
}
