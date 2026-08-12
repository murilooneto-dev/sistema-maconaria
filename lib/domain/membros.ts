export type ValidationResult = { valido: true } | { valido: false; erro: string }

/** Matrícula é opcional — membros em processo de iniciação ainda não têm uma (SPEC ampliado a pedido do usuário, 2026-08-12). */
export function validarMembro(input: { nome: string; matricula: string }): ValidationResult {
  if (input.nome.trim().length === 0) {
    return { valido: false, erro: 'Informe o nome do membro.' }
  }

  return { valido: true }
}
