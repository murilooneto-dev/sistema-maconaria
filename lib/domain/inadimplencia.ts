/**
 * Regra de inadimplência (SPEC §7, estendida em 2026-08-13): mais de 6
 * competências vencidas e não pagas torna o membro INATIVO; mais de 12,
 * IRREGULAR (degrau mais grave — para de gerar mensalidade nova e sai dos
 * cálculos de inadimplência/Grande Loja, decisão do usuário). Reativação é
 * automática nos dois sentidos: o valor recalculado sempre reflete o
 * número atual de competências vencidas, então regularizar o pagamento
 * baixa a situação sozinha (IRREGULAR → INATIVO → ATIVO conforme o número
 * cai). Esta função é pura — quem chama é responsável por contar as
 * competências vencidas.
 */
export function calcularSituacaoMembro(competenciasVencidasNaoPagas: number): 'ATIVO' | 'INATIVO' | 'IRREGULAR' {
  if (competenciasVencidasNaoPagas > 12) return 'IRREGULAR'
  if (competenciasVencidasNaoPagas > 6) return 'INATIVO'
  return 'ATIVO'
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
