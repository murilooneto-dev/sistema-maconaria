const INTERNAL_EMAIL_DOMAIN = 'loja.internal'

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

export function usernameToAuthEmail(username: string): string {
  const normalized = normalizeUsername(username)
  if (normalized.length === 0) {
    throw new Error('username inválido')
  }
  return `${normalized}@${INTERNAL_EMAIL_DOMAIN}`
}
