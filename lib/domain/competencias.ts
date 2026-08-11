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
