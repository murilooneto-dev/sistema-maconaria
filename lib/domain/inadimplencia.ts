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
