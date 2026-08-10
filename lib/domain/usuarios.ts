import type { Role } from './authorization'

const ROLES: readonly Role[] = ['ADMINISTRADOR', 'TESOUREIRO', 'CONSULTA']

export type ValidationResult = { valido: true } | { valido: false; erro: string }

function roleValido(role: string): role is Role {
  return (ROLES as readonly string[]).includes(role)
}

export function validarSenha(senha: string): ValidationResult {
  if (senha.length < 8) {
    return { valido: false, erro: 'A senha deve ter pelo menos 8 caracteres.' }
  }

  return { valido: true }
}

export function validarNovoUsuario(input: {
  username: string
  nome: string
  role: string
  senha: string
}): ValidationResult {
  const username = input.username.trim()

  if (username.length === 0) {
    return { valido: false, erro: 'Informe o username.' }
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return {
      valido: false,
      erro: 'Username deve conter apenas letras, números, ponto, hífen ou underscore.',
    }
  }

  if (input.nome.trim().length === 0) {
    return { valido: false, erro: 'Informe o nome completo.' }
  }

  if (!roleValido(input.role)) {
    return { valido: false, erro: 'Perfil inválido.' }
  }

  const senhaValidacao = validarSenha(input.senha)
  if (!senhaValidacao.valido) {
    return senhaValidacao
  }

  return { valido: true }
}

export function validarEdicaoUsuario(input: { nome: string; role: string }): ValidationResult {
  if (input.nome.trim().length === 0) {
    return { valido: false, erro: 'Informe o nome completo.' }
  }

  if (!roleValido(input.role)) {
    return { valido: false, erro: 'Perfil inválido.' }
  }

  return { valido: true }
}
