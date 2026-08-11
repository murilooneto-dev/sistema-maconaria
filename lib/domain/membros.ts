export type ValidationResult = { valido: true } | { valido: false; erro: string }

export function validarMembro(input: { nome: string; matricula: string }): ValidationResult {
  if (input.nome.trim().length === 0) {
    return { valido: false, erro: 'Informe o nome do membro.' }
  }

  if (input.matricula.trim().length === 0) {
    return { valido: false, erro: 'Informe a matrícula.' }
  }

  return { valido: true }
}
