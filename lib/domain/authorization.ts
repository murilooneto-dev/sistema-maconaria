export type Role = 'ADMINISTRADOR' | 'TESOUREIRO' | 'CONSULTA'

export type PerfilAutorizacao = {
  role: Role
  ativo: boolean
} | null

/**
 * Regra de decisão de autorização por role — pura, sem I/O.
 * `minimo: 'ADMINISTRADOR'` exige exatamente ADMINISTRADOR.
 * `minimo: 'TESOUREIRO'` aceita ADMINISTRADOR ou TESOUREIRO.
 * Perfil nulo ou inativo nunca é autorizado, independente do role.
 */
export function canAccess(perfil: PerfilAutorizacao, minimo: 'ADMINISTRADOR' | 'TESOUREIRO'): boolean {
  if (!perfil || !perfil.ativo) {
    return false
  }

  if (minimo === 'ADMINISTRADOR') {
    return perfil.role === 'ADMINISTRADOR'
  }

  return perfil.role === 'ADMINISTRADOR' || perfil.role === 'TESOUREIRO'
}
