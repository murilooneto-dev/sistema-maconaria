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

export function normalizarEmail(email: string): string | null {
  const normalizado = email.trim().toLowerCase()
  return normalizado.length === 0 ? null : normalizado
}

/**
 * E-mail real do usuário — é o login do sistema e o destino do link de
 * recuperação de senha, por isso obrigatório. O domínio interno
 * `loja.internal` é recusado: é o endereço fictício de autenticação dos
 * usuários antigos sem e-mail, e nunca receberia mensagem alguma.
 */
export function validarEmail(email: string): ValidationResult {
  const normalizado = normalizarEmail(email)
  if (normalizado === null) {
    return { valido: false, erro: 'Informe o e-mail.' }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) {
    return { valido: false, erro: 'Informe um e-mail válido.' }
  }

  if (normalizado.endsWith('@loja.internal')) {
    return { valido: false, erro: 'Informe um e-mail real do usuário.' }
  }

  return { valido: true }
}

export function validarNovoUsuario(input: {
  username: string
  nome: string
  role: string
  senha: string
  email?: string
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

  return validarEmail(input.email ?? '')
}

export function validarEdicaoUsuario(input: { nome: string; role: string; email?: string }): ValidationResult {
  if (input.nome.trim().length === 0) {
    return { valido: false, erro: 'Informe o nome completo.' }
  }

  if (!roleValido(input.role)) {
    return { valido: false, erro: 'Perfil inválido.' }
  }

  return validarEmail(input.email ?? '')
}
