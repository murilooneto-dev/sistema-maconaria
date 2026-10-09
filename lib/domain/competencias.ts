export type Competencia = { ano: number; mes: number }

/**
 * SPEC §10 (revisado em 2026-10-09): o novo membro gera mensalidade a
 * partir do PRÓPRIO mês do cadastro. Cadastro em 15/08/2026 → primeira
 * competência 08/2026. `dataCadastro` é a coluna `date` do banco
 * (YYYY-MM-DD), lida pelo texto pra não depender de fuso horário.
 */
export function competenciaDoCadastro(dataCadastro: string): Competencia {
  const [ano, mes] = dataCadastro.split('-').map(Number)
  return { ano, mes }
}

/**
 * Primeira competência que o membro deve ter em `ano`: janeiro, ou o mês
 * do cadastro se ele entrou no meio desse ano. Se o cadastro for posterior
 * a `ano`, devolve a própria competência do cadastro (fora do ano), o que
 * faz `competenciasFaltantes` não gerar nada.
 */
export function primeiraCompetenciaDoAno(dataCadastro: string, ano: number): Competencia {
  const cadastro = competenciaDoCadastro(dataCadastro)
  const janeiro: Competencia = { ano, mes: 1 }
  return competenciaMenorOuIgual(cadastro, janeiro) ? janeiro : cadastro
}

function paraIndice(c: Competencia): number {
  return c.ano * 12 + (c.mes - 1)
}

function deIndice(indice: number): Competencia {
  return { ano: Math.floor(indice / 12), mes: (indice % 12) + 1 }
}

function competenciaMenorOuIgual(a: Competencia, b: Competencia): boolean {
  return paraIndice(a) <= paraIndice(b)
}

function proximaCompetencia(c: Competencia): Competencia {
  return deIndice(paraIndice(c) + 1)
}

function chave(c: Competencia): string {
  return `${c.ano}-${String(c.mes).padStart(2, '0')}`
}

/**
 * Lista as competências entre `primeira` e `ate` (inclusive) que ainda não
 * existem em `existentes`. Não gera nada se `primeira` for posterior a
 * `ate`.
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
