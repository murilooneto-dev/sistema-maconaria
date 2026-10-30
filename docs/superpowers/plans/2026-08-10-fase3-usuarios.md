# Fase 3 — Usuários Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar administração de usuários (perfis) e a infraestrutura reutilizável de permissões/auditoria: cliente Supabase com `service_role`, verificação de autorização server-side (`requireAdmin`/`requireTesoureiro`), gravação de auditoria, e CRUD completo de usuários em `/configuracoes/usuarios` (criar, editar nome/perfil, ativar/desativar, redefinir senha) — só para Administrador, com auditoria de toda operação.

**Architecture:** A tabela `profiles` (Fase 1) e o RLS por role (Fase 2) já existem. Como as operações desta fase (criar usuário no Supabase Auth, gravar auditoria) exigem `service_role` — que **ignora RLS inteiramente** — a autorização real desta fase não vem do banco, vem da própria Server Action: toda Server Action que usa o client `service_role` começa chamando `requireAdmin()`, que lê a sessão do usuário chamador com o client normal (RLS ligado) e nega a operação antes de tocar no client privilegiado. `lib/domain/authorization.ts` isola a regra de decisão (pura, testável); `lib/auth/require-role.ts` faz a leitura de sessão + aplica a regra; `lib/supabase/service.ts` isola o client privilegiado atrás do pacote `server-only` (o build falha se for importado por engano em código client-side).

**Tech Stack:** Next.js Server Actions, `@supabase/supabase-js` (Admin API para criar/editar usuários em `auth.users`), `server-only`, Vitest.

## Global Constraints

- `SUPABASE_SERVICE_ROLE_KEY` nunca é importada por código client-side — reforçado via pacote `server-only` (CLAUDE.md §11, princípio 12 do SPEC).
- Toda operação administrativa sobre usuários é restrita a `ADMINISTRADOR`, verificado no servidor antes de qualquer escrita — nunca confiar só na UI (SPEC princípio 10, CLAUDE.md §10).
- Toda criação/edição/ativação/desativação/redefinição de senha de usuário gera uma linha em `auditoria` (SPEC §30, CLAUDE.md §12).
- Nenhuma senha própria é armazenada em tabela da aplicação — senha continua 100% delegada ao Supabase Auth (SPEC princípio 11).
- TypeScript estrito, sem `any` não justificado.
- Toda tela possui estados de loading/vazio/erro/sucesso/confirmação (CLAUDE.md §13).

## Decisões técnicas (não bloqueantes, puramente técnicas)

1. **Username é imutável após a criação do usuário.** Editar permite mudar `nome` e `role`, não `username` — porque o username determina o e-mail interno (`usernameToAuthEmail`) usado no Supabase Auth, e sincronizar uma mudança de username com uma mudança de e-mail em `auth.users` introduz risco de dessincronia sem benefício real (SPEC não pede edição de username). Se necessário trocar, desativa-se o usuário antigo e cria-se um novo.
2. **Se a auditoria falhar depois de uma operação já bem-sucedida** (ex: criar usuário funcionou, mas o insert em `auditoria` falhou por erro transitório), a operação principal **não é revertida** — a Server Action retorna sucesso normalmente. Não há transação cruzando `auth.users`/`profiles`/`auditoria` (são chamadas remotas separadas); reverter uma criação de usuário bem-sucedida por causa de uma falha de auditoria seria pior para o usuário final do que aceitar o risco raro de uma auditoria incompleta. Já a falha ao criar o `profiles` **depois** de criar o `auth.users` é revertida (o usuário Auth órfão é deletado), porque nesse caso o sistema ficaria em um estado inconsistente (login possível sem perfil).
3. **Administrador não pode desativar a própria conta** — trava de segurança simples para evitar lockout total do sistema (ninguém mais poderia reativar).
4. **Erro ao criar usuário no Supabase Auth é repassado com a mensagem original do Supabase** (ex: e-mail/username já existe), sem tentar mapear códigos de erro específicos do SDK — mais simples e não depende de comportamento interno não documentado do SDK.

---

## Task 1: Client `service_role` + domínio de autorização + `requireAdmin`/`requireTesoureiro`

**Files:**
- Create: `lib/env.ts` (modificar — adicionar `getServiceRoleKey()`)
- Create: `lib/supabase/service.ts`
- Create: `lib/domain/authorization.ts`
- Test: `lib/domain/authorization.test.ts`
- Create: `lib/auth/require-role.ts`
- Modify: `package.json` (dependência `server-only`)

**Interfaces:**
- Produces: `getServiceRoleKey(): string`, `createSupabaseServiceRoleClient(): SupabaseClient`, `canAccess(profile: {role: Role; ativo: boolean} | null, minimo: 'ADMINISTRADOR' | 'TESOUREIRO'): boolean`, `requireAdmin(): Promise<{id: string; role: Role; ativo: boolean}>`, `requireTesoureiro(): Promise<{id: string; role: Role; ativo: boolean}>`, `class AuthorizationError extends Error`.

- [ ] **Step 1: Instalar `server-only`**

```bash
npm install server-only
```

- [ ] **Step 2: Adicionar `getServiceRoleKey()` a `lib/env.ts`**

Ler o arquivo atual antes de editar (já tem `getPublicEnv()` com o mesmo padrão de zod). Adicionar, no mesmo arquivo:

```typescript
const REQUIRED_SERVICE_ROLE_MESSAGE =
  'Variável de ambiente SUPABASE_SERVICE_ROLE_KEY não configurada — copie .env.example para .env.local'

const serviceRoleEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, REQUIRED_SERVICE_ROLE_MESSAGE),
})

let cachedServiceRoleKey: string | undefined

/**
 * Lê e valida a service_role key. Só deve ser chamada a partir de código
 * server-only (ver lib/supabase/service.ts) — nunca client-side.
 */
export function getServiceRoleKey(): string {
  if (cachedServiceRoleKey) {
    return cachedServiceRoleKey
  }

  const parsed = serviceRoleEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  })

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? REQUIRED_SERVICE_ROLE_MESSAGE)
  }

  cachedServiceRoleKey = parsed.data.SUPABASE_SERVICE_ROLE_KEY
  return cachedServiceRoleKey
}
```

Não remover nem alterar `getPublicEnv()` já existente.

- [ ] **Step 3: Criar `lib/supabase/service.ts`**

```typescript
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { getPublicEnv, getServiceRoleKey } from '@/lib/env'

/**
 * Client Supabase com a service_role key — ignora RLS inteiramente.
 * Nunca chamar a partir de código que não tenha antes verificado a
 * autorização do usuário chamador (ver lib/auth/require-role.ts).
 * O pacote `server-only` faz o build falhar se este módulo for importado
 * por engano em um componente client-side.
 */
export function createSupabaseServiceRoleClient() {
  const env = getPublicEnv()
  const serviceRoleKey = getServiceRoleKey()

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

- [ ] **Step 4: Escrever o teste que falha primeiro para `lib/domain/authorization.ts`**

```typescript
// lib/domain/authorization.test.ts
import { describe, expect, it } from 'vitest'
import { canAccess } from './authorization'

describe('canAccess', () => {
  it('nega quando o perfil é null', () => {
    expect(canAccess(null, 'ADMINISTRADOR')).toBe(false)
  })

  it('nega quando o perfil está inativo, mesmo sendo ADMINISTRADOR', () => {
    expect(canAccess({ role: 'ADMINISTRADOR', ativo: false }, 'ADMINISTRADOR')).toBe(false)
  })

  it('permite ADMINISTRADOR ativo quando o mínimo é ADMINISTRADOR', () => {
    expect(canAccess({ role: 'ADMINISTRADOR', ativo: true }, 'ADMINISTRADOR')).toBe(true)
  })

  it('nega TESOUREIRO quando o mínimo é ADMINISTRADOR', () => {
    expect(canAccess({ role: 'TESOUREIRO', ativo: true }, 'ADMINISTRADOR')).toBe(false)
  })

  it('permite TESOUREIRO ativo quando o mínimo é TESOUREIRO', () => {
    expect(canAccess({ role: 'TESOUREIRO', ativo: true }, 'TESOUREIRO')).toBe(true)
  })

  it('permite ADMINISTRADOR ativo quando o mínimo é TESOUREIRO', () => {
    expect(canAccess({ role: 'ADMINISTRADOR', ativo: true }, 'TESOUREIRO')).toBe(true)
  })

  it('nega CONSULTA quando o mínimo é TESOUREIRO', () => {
    expect(canAccess({ role: 'CONSULTA', ativo: true }, 'TESOUREIRO')).toBe(false)
  })
})
```

- [ ] **Step 5: Rodar e confirmar falha**

Run: `npx vitest run lib/domain/authorization.test.ts`
Expected: FAIL — `Cannot find module './authorization'`.

- [ ] **Step 6: Implementar `lib/domain/authorization.ts`**

```typescript
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
```

- [ ] **Step 7: Rodar e confirmar sucesso**

Run: `npx vitest run lib/domain/authorization.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 8: Criar `lib/auth/require-role.ts`**

```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { canAccess, type PerfilAutorizacao, type Role } from '@/lib/domain/authorization'

export class AuthorizationError extends Error {}

type PerfilAtual = { id: string; role: Role; ativo: boolean }

async function perfilAtual(): Promise<PerfilAtual | null> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, ativo')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return null
  }

  return { id: profile.id, role: profile.role as Role, ativo: profile.ativo }
}

function paraDecisao(perfil: PerfilAtual | null): PerfilAutorizacao {
  if (!perfil) {
    return null
  }
  return { role: perfil.role, ativo: perfil.ativo }
}

/** Lança AuthorizationError se o usuário atual não for ADMINISTRADOR ativo. */
export async function requireAdmin(): Promise<PerfilAtual> {
  const perfil = await perfilAtual()

  if (!canAccess(paraDecisao(perfil), 'ADMINISTRADOR')) {
    throw new AuthorizationError('Apenas o Administrador pode executar esta ação.')
  }

  return perfil as PerfilAtual
}

/** Lança AuthorizationError se o usuário atual não for ADMINISTRADOR ou TESOUREIRO ativo. */
export async function requireTesoureiro(): Promise<PerfilAtual> {
  const perfil = await perfilAtual()

  if (!canAccess(paraDecisao(perfil), 'TESOUREIRO')) {
    throw new AuthorizationError('Apenas Administrador ou Tesoureiro podem executar esta ação.')
  }

  return perfil as PerfilAtual
}
```

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json lib/env.ts lib/supabase/service.ts lib/domain/authorization.ts lib/domain/authorization.test.ts lib/auth/require-role.ts
git commit -m "feat: client service_role, domínio de autorização e requireAdmin/requireTesoureiro"
```

---

## Task 2: Auditoria writer

**Files:**
- Create: `lib/audit.ts`

**Interfaces:**
- Consumes: `createSupabaseServiceRoleClient` (Task 1).
- Produces: `registrarAuditoria(input: RegistrarAuditoriaInput): Promise<void>` — usado por toda Server Action administrativa a partir da Task 4.

- [ ] **Step 1: Criar `lib/audit.ts`**

```typescript
import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'

export type RegistrarAuditoriaInput = {
  usuarioId: string
  modulo: string
  acao: string
  registroTabela?: string
  registroId?: string
  dadosAnteriores?: Record<string, unknown> | null
  dadosNovos?: Record<string, unknown> | null
  descricao?: string
}

/**
 * Grava uma linha de auditoria via service_role (a tabela `auditoria` não
 * tem policy de INSERT para clientes — escrita é sempre server-side).
 * Lança erro se a gravação falhar; ver decisão técnica 2 do plano da Fase 3
 * sobre por que a operação principal que chamou isto não é revertida.
 */
export async function registrarAuditoria(input: RegistrarAuditoriaInput): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()

  const { error } = await supabase.from('auditoria').insert({
    usuario_id: input.usuarioId,
    modulo: input.modulo,
    acao: input.acao,
    registro_tabela: input.registroTabela ?? null,
    registro_id: input.registroId ?? null,
    dados_anteriores: input.dadosAnteriores ?? null,
    dados_novos: input.dadosNovos ?? null,
    descricao: input.descricao ?? null,
  })

  if (error) {
    throw new Error(`Falha ao registrar auditoria: ${error.message}`)
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/audit.ts
git commit -m "feat: helper de gravação de auditoria via service_role"
```

---

## Task 3: Domínio de validação de usuários

**Files:**
- Create: `lib/domain/usuarios.ts`
- Test: `lib/domain/usuarios.test.ts`

**Interfaces:**
- Produces: `validarNovoUsuario(input): ValidationResult`, `validarEdicaoUsuario(input): ValidationResult`, `ValidationResult = { valido: true } | { valido: false; erro: string }`.
- Consumes: nada (funções puras).

- [ ] **Step 1: Escrever o teste que falha primeiro**

```typescript
// lib/domain/usuarios.test.ts
import { describe, expect, it } from 'vitest'
import { validarEdicaoUsuario, validarNovoUsuario } from './usuarios'

describe('validarNovoUsuario', () => {
  const base = { username: 'joao.silva', nome: 'João Silva', role: 'CONSULTA', senha: 'senha1234' }

  it('aceita um input válido', () => {
    expect(validarNovoUsuario(base)).toEqual({ valido: true })
  })

  it('rejeita username vazio', () => {
    expect(validarNovoUsuario({ ...base, username: '   ' })).toEqual({
      valido: false,
      erro: 'Informe o username.',
    })
  })

  it('rejeita username com caracteres inválidos', () => {
    expect(validarNovoUsuario({ ...base, username: 'joão silva!' })).toEqual({
      valido: false,
      erro: 'Username deve conter apenas letras, números, ponto, hífen ou underscore.',
    })
  })

  it('rejeita nome vazio', () => {
    expect(validarNovoUsuario({ ...base, nome: '  ' })).toEqual({
      valido: false,
      erro: 'Informe o nome completo.',
    })
  })

  it('rejeita role inválido', () => {
    expect(validarNovoUsuario({ ...base, role: 'SUPER_ADMIN' })).toEqual({
      valido: false,
      erro: 'Perfil inválido.',
    })
  })

  it('rejeita senha com menos de 8 caracteres', () => {
    expect(validarNovoUsuario({ ...base, senha: '1234567' })).toEqual({
      valido: false,
      erro: 'A senha deve ter pelo menos 8 caracteres.',
    })
  })
})

describe('validarEdicaoUsuario', () => {
  it('aceita um input válido', () => {
    expect(validarEdicaoUsuario({ nome: 'João Silva', role: 'TESOUREIRO' })).toEqual({ valido: true })
  })

  it('rejeita nome vazio', () => {
    expect(validarEdicaoUsuario({ nome: '', role: 'TESOUREIRO' })).toEqual({
      valido: false,
      erro: 'Informe o nome completo.',
    })
  })

  it('rejeita role inválido', () => {
    expect(validarEdicaoUsuario({ nome: 'João Silva', role: 'X' })).toEqual({
      valido: false,
      erro: 'Perfil inválido.',
    })
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run lib/domain/usuarios.test.ts`
Expected: FAIL — `Cannot find module './usuarios'`.

- [ ] **Step 3: Implementar `lib/domain/usuarios.ts`**

```typescript
import type { Role } from './authorization'

const ROLES: readonly Role[] = ['ADMINISTRADOR', 'TESOUREIRO', 'CONSULTA']

export type ValidationResult = { valido: true } | { valido: false; erro: string }

function roleValido(role: string): role is Role {
  return (ROLES as readonly string[]).includes(role)
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

  if (input.senha.length < 8) {
    return { valido: false, erro: 'A senha deve ter pelo menos 8 caracteres.' }
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
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run lib/domain/usuarios.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/usuarios.ts lib/domain/usuarios.test.ts
git commit -m "feat: validação de domínio para criação/edição de usuários com testes"
```

---

## Task 4: Server Actions de usuários

**Files:**
- Create: `app/(app)/configuracoes/usuarios/actions.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `AuthorizationError` (Task 1); `createSupabaseServiceRoleClient` (Task 1); `registrarAuditoria` (Task 2); `validarNovoUsuario`, `validarEdicaoUsuario` (Task 3); `usernameToAuthEmail`, `normalizeUsername` (`lib/domain/auth.ts`, já existe da Fase 1).
- Produces: `criarUsuario(prevState, formData): Promise<{error: string} | {success: string} | undefined>`, `atualizarUsuario(id, nome, role): Promise<{error?: string}>`, `alterarStatusUsuario(id, ativo): Promise<{error?: string}>`, `redefinirSenha(id, novaSenha): Promise<{error?: string}>`.

- [ ] **Step 1: Criar `app/(app)/configuracoes/usuarios/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { normalizeUsername, usernameToAuthEmail } from '@/lib/domain/auth'
import { validarEdicaoUsuario, validarNovoUsuario } from '@/lib/domain/usuarios'
import type { Role } from '@/lib/domain/authorization'

type CriarUsuarioState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function criarUsuario(
  _prevState: CriarUsuarioState,
  formData: FormData
): Promise<CriarUsuarioState> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const input = {
    username: String(formData.get('username') ?? ''),
    nome: String(formData.get('nome') ?? ''),
    role: String(formData.get('role') ?? ''),
    senha: String(formData.get('senha') ?? ''),
  }

  const validacao = validarNovoUsuario(input)
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const username = normalizeUsername(input.username)
  const email = usernameToAuthEmail(input.username)
  const role = input.role as Role
  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.senha,
    email_confirm: true,
  })

  if (createError || !created.user) {
    return { error: `Falha ao criar usuário: ${createError?.message ?? 'erro desconhecido'}` }
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: created.user.id,
    username,
    nome: input.nome.trim(),
    role,
    ativo: true,
  })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id)
    return { error: `Falha ao criar perfil: ${profileError.message}` }
  }

  await registrarAuditoria({
    usuarioId: admin.id,
    modulo: 'usuarios',
    acao: 'CRIACAO',
    registroTabela: 'profiles',
    registroId: created.user.id,
    dadosNovos: { username, nome: input.nome.trim(), role, ativo: true },
    descricao: `Criação do usuário ${username}`,
  })

  revalidatePath('/configuracoes/usuarios')
  return { success: 'Usuário criado com sucesso.' }
}

export async function atualizarUsuario(
  id: string,
  nome: string,
  role: string
): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const validacao = validarEdicaoUsuario({ nome, role })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anterior } = await supabaseAdmin
    .from('profiles')
    .select('nome, role')
    .eq('id', id)
    .single()

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ nome: nome.trim(), role })
    .eq('id', id)

  if (error) {
    return { error: `Falha ao atualizar usuário: ${error.message}` }
  }

  await registrarAuditoria({
    usuarioId: admin.id,
    modulo: 'usuarios',
    acao: 'EDICAO',
    registroTabela: 'profiles',
    registroId: id,
    dadosAnteriores: anterior ?? null,
    dadosNovos: { nome: nome.trim(), role },
    descricao: `Edição do usuário ${id}`,
  })

  revalidatePath('/configuracoes/usuarios')
  return {}
}

export async function alterarStatusUsuario(id: string, ativo: boolean): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  if (admin.id === id && !ativo) {
    return { error: 'Você não pode desativar seu próprio usuário.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anterior } = await supabaseAdmin
    .from('profiles')
    .select('ativo')
    .eq('id', id)
    .single()

  const { error } = await supabaseAdmin.from('profiles').update({ ativo }).eq('id', id)

  if (error) {
    return { error: `Falha ao atualizar status: ${error.message}` }
  }

  await registrarAuditoria({
    usuarioId: admin.id,
    modulo: 'usuarios',
    acao: ativo ? 'REATIVACAO' : 'DESATIVACAO',
    registroTabela: 'profiles',
    registroId: id,
    dadosAnteriores: anterior ?? null,
    dadosNovos: { ativo },
    descricao: `${ativo ? 'Reativação' : 'Desativação'} do usuário ${id}`,
  })

  revalidatePath('/configuracoes/usuarios')
  return {}
}

export async function redefinirSenha(id: string, novaSenha: string): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  if (novaSenha.length < 8) {
    return { error: 'A senha deve ter pelo menos 8 caracteres.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password: novaSenha })

  if (error) {
    return { error: `Falha ao redefinir senha: ${error.message}` }
  }

  await registrarAuditoria({
    usuarioId: admin.id,
    modulo: 'usuarios',
    acao: 'REDEFINICAO_SENHA',
    registroTabela: 'profiles',
    registroId: id,
    descricao: `Redefinição de senha do usuário ${id}`,
  })

  revalidatePath('/configuracoes/usuarios')
  return {}
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/configuracoes/usuarios/actions.ts"
git commit -m "feat: Server Actions de administração de usuários com auditoria"
```

---

## Task 5: UI — página de usuários (listagem + criação) e hub de Configurações

**Files:**
- Create: `components/AcessoNegado.tsx`
- Create: `app/(app)/configuracoes/usuarios/NovoUsuarioForm.tsx`
- Create: `app/(app)/configuracoes/usuarios/page.tsx`
- Modify: `app/(app)/configuracoes/page.tsx` (substituir o placeholder genérico por um hub com o card "Usuários" real para Administrador)

**Interfaces:**
- Consumes: `criarUsuario` (Task 4), `createSupabaseServerClient` (já existe).

- [ ] **Step 1: Criar `components/AcessoNegado.tsx`**

```tsx
export function AcessoNegado() {
  return (
    <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      Você não tem permissão para acessar esta página.
    </div>
  )
}
```

- [ ] **Step 2: Criar `app/(app)/configuracoes/usuarios/NovoUsuarioForm.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { criarUsuario } from './actions'

export function NovoUsuarioForm() {
  const [state, formAction, pending] = useActionState(criarUsuario, undefined)

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">Novo usuário</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="username" className="text-sm font-medium text-slate-700">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="off"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="nome" className="text-sm font-medium text-slate-700">
            Nome completo
          </label>
          <input
            id="nome"
            name="nome"
            type="text"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="role" className="text-sm font-medium text-slate-700">
            Perfil
          </label>
          <select
            id="role"
            name="role"
            required
            defaultValue="CONSULTA"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ADMINISTRADOR">Administrador</option>
            <option value="TESOUREIRO">Tesoureiro</option>
            <option value="CONSULTA">Consulta</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="senha" className="text-sm font-medium text-slate-700">
            Senha temporária
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {state && 'error' in state && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state && 'success' in state && (
        <p className="text-sm text-green-700" role="status">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Criando...' : 'Criar usuário'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Criar `app/(app)/configuracoes/usuarios/page.tsx`**

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { NovoUsuarioForm } from './NovoUsuarioForm'
import { UsuariosTable } from './UsuariosTable'

export default async function UsuariosPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'ADMINISTRADOR') {
    return <AcessoNegado />
  }

  const { data: usuarios, error } = await supabase
    .from('profiles')
    .select('id, username, nome, role, ativo, created_at')
    .order('nome')

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar usuários: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Usuários</h1>

      <NovoUsuarioForm />

      {usuarios.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum usuário cadastrado.</p>
      ) : (
        <UsuariosTable usuarios={usuarios} currentUserId={user.id} />
      )}
    </div>
  )
}
```

Nota: `UsuariosTable` é criado na Task 6 — este arquivo só compila de fato ao final da Task 6, mas o import já é escrito aqui porque a página depende dele. Isso é aceitável dentro do mesmo plano sequencial; não é um estado "quebrado" commitado sozinho porque a Task 6 é a próxima e conclui o par.

- [ ] **Step 4: Atualizar `app/(app)/configuracoes/page.tsx`**

Ler o arquivo atual (placeholder genérico) antes de substituir. Novo conteúdo:

```tsx
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const SECOES = [
  { titulo: 'Usuários', href: '/configuracoes/usuarios', apenasAdmin: true },
  { titulo: 'Loja', href: null },
  { titulo: 'Mensalidades', href: null },
  { titulo: 'Remidos', href: null },
  { titulo: 'Contas', href: null },
  { titulo: 'Formas de pagamento', href: null },
  { titulo: 'Recibo', href: null },
] as const

export default async function ConfiguracoesPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    isAdmin = profile?.role === 'ADMINISTRADOR'
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Configurações</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECOES.map((secao) => {
          const habilitado = secao.href !== null && (!secao.apenasAdmin || isAdmin)

          if (habilitado && secao.href) {
            return (
              <Link
                key={secao.titulo}
                href={secao.href}
                className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-medium text-slate-900 hover:border-slate-400"
              >
                {secao.titulo}
              </Link>
            )
          }

          return (
            <div
              key={secao.titulo}
              className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-400"
            >
              {secao.titulo}
              <span className="ml-2 text-xs">(em breve)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/AcessoNegado.tsx "app/(app)/configuracoes/usuarios/NovoUsuarioForm.tsx" "app/(app)/configuracoes/usuarios/page.tsx" "app/(app)/configuracoes/page.tsx"
git commit -m "feat: hub de Configurações e tela de listagem/criação de usuários"
```

---

## Task 6: UI — tabela de usuários com edição, ativação/desativação e redefinição de senha

**Files:**
- Create: `app/(app)/configuracoes/usuarios/UsuariosTable.tsx`

**Interfaces:**
- Consumes: `atualizarUsuario`, `alterarStatusUsuario`, `redefinirSenha` (Task 4).

- [ ] **Step 1: Criar `app/(app)/configuracoes/usuarios/UsuariosTable.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { alterarStatusUsuario, atualizarUsuario, redefinirSenha } from './actions'

type Usuario = {
  id: string
  username: string
  nome: string
  role: 'ADMINISTRADOR' | 'TESOUREIRO' | 'CONSULTA'
  ativo: boolean
  created_at: string
}

export function UsuariosTable({
  usuarios,
  currentUserId,
}: {
  usuarios: Usuario[]
  currentUserId: string
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ id: string; message: string; isError: boolean } | null>(
    null
  )

  function handleToggleStatus(usuario: Usuario) {
    const confirmMessage = usuario.ativo
      ? `Desativar o usuário ${usuario.nome}? Ele não poderá mais acessar o sistema.`
      : `Reativar o usuário ${usuario.nome}?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    startTransition(async () => {
      const result = await alterarStatusUsuario(usuario.id, !usuario.ativo)
      setFeedback({
        id: usuario.id,
        message: result.error ?? 'Status atualizado.',
        isError: Boolean(result.error),
      })
    })
  }

  function handleResetPassword(usuario: Usuario) {
    const novaSenha = window.prompt(
      `Nova senha temporária para ${usuario.nome} (mínimo 8 caracteres):`
    )
    if (!novaSenha) {
      return
    }

    startTransition(async () => {
      const result = await redefinirSenha(usuario.id, novaSenha)
      setFeedback({
        id: usuario.id,
        message: result.error ?? 'Senha redefinida.',
        isError: Boolean(result.error),
      })
    })
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Username</th>
            <th className="px-4 py-2 font-medium">Nome</th>
            <th className="px-4 py-2 font-medium">Perfil</th>
            <th className="px-4 py-2 font-medium">Situação</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((usuario) => (
            <tr key={usuario.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2 text-slate-500">{usuario.username}</td>
              <td className="px-4 py-2">
                {editingId === usuario.id ? (
                  <EditForm
                    usuario={usuario}
                    pending={isPending}
                    onCancel={() => setEditingId(null)}
                    onSave={(nome, role) => {
                      startTransition(async () => {
                        const result = await atualizarUsuario(usuario.id, nome, role)
                        setFeedback({
                          id: usuario.id,
                          message: result.error ?? 'Usuário atualizado.',
                          isError: Boolean(result.error),
                        })
                        if (!result.error) {
                          setEditingId(null)
                        }
                      })
                    }}
                  />
                ) : (
                  usuario.nome
                )}
              </td>
              <td className="px-4 py-2">{editingId === usuario.id ? '—' : usuario.role}</td>
              <td className="px-4 py-2">
                <span className={usuario.ativo ? 'text-green-700' : 'text-slate-400'}>
                  {usuario.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </td>
              <td className="space-x-2 px-4 py-2">
                {editingId !== usuario.id && (
                  <button
                    type="button"
                    onClick={() => setEditingId(usuario.id)}
                    className="text-slate-700 underline"
                  >
                    Editar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleToggleStatus(usuario)}
                  disabled={isPending || usuario.id === currentUserId}
                  className="text-slate-700 underline disabled:opacity-50"
                >
                  {usuario.ativo ? 'Desativar' : 'Reativar'}
                </button>
                <button
                  type="button"
                  onClick={() => handleResetPassword(usuario)}
                  disabled={isPending}
                  className="text-slate-700 underline disabled:opacity-50"
                >
                  Redefinir senha
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {feedback && (
        <p
          className={`px-4 py-2 text-sm ${feedback.isError ? 'text-red-600' : 'text-green-700'}`}
          role={feedback.isError ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      )}
    </div>
  )
}

function EditForm({
  usuario,
  pending,
  onSave,
  onCancel,
}: {
  usuario: Usuario
  pending: boolean
  onSave: (nome: string, role: Usuario['role']) => void
  onCancel: () => void
}) {
  const [nome, setNome] = useState(usuario.nome)
  const [role, setRole] = useState<Usuario['role']>(usuario.role)

  return (
    <div className="space-y-2">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as Usuario['role'])}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      >
        <option value="ADMINISTRADOR">Administrador</option>
        <option value="TESOUREIRO">Tesoureiro</option>
        <option value="CONSULTA">Consulta</option>
      </select>
      <div className="space-x-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => onSave(nome, role)}
          className="text-sm text-slate-900 underline disabled:opacity-50"
        >
          Salvar
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 underline">
          Cancelar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build concluído sem erros (as chamadas ao Supabase falham em runtime sem credenciais reais durante `npm run dev`, mas o build estático/tipagem deve passar, igual nas fases anteriores).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/configuracoes/usuarios/UsuariosTable.tsx"
git commit -m "feat: tabela de usuários com edição, ativação/desativação e redefinição de senha"
```

---

## Task 7: Documentação e checagem final

**Files:**
- Create: `docs/permissoes.md`
- Modify: `docs/banco.md` (adicionar nota sobre `registrarAuditoria` como único caminho de escrita em `auditoria`)
- Modify: `docs/arquitetura.md` (atualizar árvore de pastas)
- Modify: `docs/instalacao.md` (a criação manual do primeiro Administrador, descrita na Fase 1, agora pode ser feita pela UI — adicionar nota)

- [ ] **Step 1: Criar `docs/permissoes.md`**

Documentar a matriz de permissões por role (Administrador/Tesoureiro/Consulta) conforme SPEC §3, e as duas camadas onde cada regra é imposta: RLS por tabela (Fase 2, ver `docs/banco.md`) e `requireAdmin()`/`requireTesoureiro()` nas Server Actions que usam `service_role` (Fase 3, ver `lib/auth/require-role.ts`). Explicar por que a segunda camada existe: `service_role` ignora RLS, então para operações que precisam dele (criar usuário, gravar auditoria) a única barreira é a própria Server Action. Documentar as 4 decisões técnicas do cabeçalho deste plano.

- [ ] **Step 2: Atualizar `docs/banco.md`**

Adicionar, na seção de `auditoria` já existente, uma nota: "A partir da Fase 3, toda escrita em `auditoria` passa por `lib/audit.ts` (`registrarAuditoria`), chamado pelas Server Actions administrativas — nunca diretamente do client."

- [ ] **Step 3: Atualizar `docs/arquitetura.md`**

Adicionar ao bloco de árvore de pastas: `lib/supabase/service.ts`, `lib/audit.ts`, `lib/auth/require-role.ts`, `lib/domain/authorization.ts`, `lib/domain/usuarios.ts`, `app/(app)/configuracoes/usuarios/*`, `components/AcessoNegado.tsx`.

- [ ] **Step 4: Atualizar `docs/instalacao.md`**

Na seção "Criar o primeiro usuário ADMINISTRADOR" (Fase 1), adicionar uma nota no topo: "A partir da Fase 3, um Administrador já existente pode criar novos usuários pela tela `/configuracoes/usuarios`. Este passo manual (SQL Editor) só é necessário para o **primeiro** Administrador do sistema, quando ainda não existe nenhum usuário."

- [ ] **Step 5: Checagem final**

Rodar, na ordem, e confirmar que tudo passa:

```bash
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add docs/permissoes.md docs/banco.md docs/arquitetura.md docs/instalacao.md
git commit -m "docs: matriz de permissões e atualização da documentação da Fase 3"
```

---

## Self-Review (spec coverage)

- Perfis (Administrador/Tesoureiro/Consulta) já existiam (Fase 1/2); esta fase adiciona a **administração** deles (SPEC §28 "Usuários — CRUD administrativo") → Tasks 4-6. ✅
- Permissões validadas no servidor, não só na interface (SPEC princípio 10) → `requireAdmin`/`requireTesoureiro` (Task 1), usados em toda Server Action (Task 4). ✅
- Auditoria de "administração de usuário" (SPEC §30) → `registrarAuditoria` chamado em toda operação de Task 4. ✅
- Nenhuma senha própria armazenada (SPEC princípio 11) → senha delegada 100% ao Supabase Auth Admin API. ✅
- Nenhuma secret no frontend (SPEC princípio 12) → `service_role` isolada atrás de `server-only` (Task 1). ✅
- Estados de tela (loading/vazio/erro/sucesso/confirmação) → formulário com `pending`/erro/sucesso (Task 5), tabela com confirmação via `window.confirm` antes de desativar, estado vazio ("Nenhum usuário cadastrado") (Task 5). ✅
- Testes para a regra crítica desta fase (permissões) → `authorization.test.ts` (Task 1) e `usuarios.test.ts` (Task 3), conforme CLAUDE.md §16 prioriza "permissões". ✅
- Módulos de negócio (membros, mensalidades, financeiro, campanhas, Grande Loja) → explicitamente **fora de escopo**, conforme fases seguintes do SPEC/CLAUDE.md.

## Pendência conhecida (não bloqueia a fase)

Criar um usuário de teste pela nova tela (`/configuracoes/usuarios`) só pode ser validado contra o projeto Supabase real já configurado — isso deve ser testado manualmente ao final e reportado como pendência de validação, não escondido.
