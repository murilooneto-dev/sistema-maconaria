# Permissões — Matriz por Perfil e Camadas de Enforcement

## Overview

Este documento descreve **quem pode fazer o quê** no sistema (matriz de permissões por perfil, SPEC §3) e **onde** cada regra é imposta tecnicamente. Para o schema de RLS por tabela, ver [`docs/banco.md`](./banco.md); para o fluxo de autenticação e a estrutura de `lib/auth/require-role.ts`, ver [`docs/arquitetura.md`](./arquitetura.md).

O sistema tem três perfis (`profiles.role`, ver `docs/banco.md`): `ADMINISTRADOR`, `TESOUREIRO`, `CONSULTA`. Um perfil `ativo = false` nunca é autorizado, independente do `role` (CLAUDE.md §9/§10 — desativar um usuário bloqueia toda operação de escrita e leitura restrita, não só o login).

---

## Matriz de permissões

| Área | ADMINISTRADOR | TESOUREIRO | CONSULTA |
|------|----------------|------------|----------|
| Membros (cadastro) | Ler e escrever | Somente leitura | Somente leitura |
| Configurações — Loja (nome/logo), Recibo (assinatura), Mensalidades/Remidos (`config_mensalidade`), Contas, Formas de pagamento | Ler e escrever | Somente leitura | Somente leitura |
| Mensalidades / Pagamentos | Ler e escrever | Ler e escrever | Somente leitura |
| Campanhas / Doações | Ler e escrever | Ler e escrever | Somente leitura |
| Movimentações / Transferências | Ler e escrever | Ler e escrever | Somente leitura |
| Recibos | Ler e emitir | Ler e emitir | Somente leitura |
| Repasses à Grande Loja | Ler e escrever | Ler e escrever | Somente leitura |
| Fechamento mensal — abrir/fechar | Sim | Sim (só enquanto `ABERTO`) | Não |
| Fechamento mensal — reabrir | Sim | **Não** | Não |
| Auditoria — leitura | Sim | Não | Não |
| Usuários — criar / editar / ativar-desativar / redefinir senha | Sim | Não | Não |
| Usuários — leitura do próprio perfil | Sim | Sim | Sim |

Notas:

- **Tesoureiro herda as permissões de leitura/escrita financeira** e é tratado como "no mínimo Tesoureiro" nas policies (`is_tesoureiro()` também é `true` para Administrador — ver `docs/banco.md`, seção "Funções auxiliares de RLS").
- **Consulta** é somente-leitura em todas as tabelas de domínio que possuem policy de `SELECT` — exceto `auditoria`, exclusiva de Administrador.
- **Administração de usuários é exclusiva de Administrador** — não existe variante "Tesoureiro cria usuário" ou "Consulta edita usuário" (SPEC §28, "Usuários — CRUD administrativo").
- **Todas as seis telas de `/configuracoes/*` implementadas na Fase 4** (`loja`, `mensalidades`, `remidos`, `contas`, `formas-pagamento`, `recibo`) seguem o mesmo padrão de `configuracoes/usuarios` (Fase 3): a página (Server Component) revalida `role === 'ADMINISTRADOR'` no servidor antes de renderizar (senão renderiza `AcessoNegado`), e cada Server Action de escrita chama `requireAdmin()` como primeiro passo, antes de tocar o client `service_role`. O hub `app/(app)/configuracoes/page.tsx` também oculta/mostra os links conforme o role, mas isso é só UX — a autorização real está nas duas camadas descritas acima, não no hub.

---

## As duas camadas de enforcement

Toda regra da matriz acima é imposta em **duas camadas independentes**, nunca só na interface (CLAUDE.md §10/§11, princípio 10 do SPEC):

### Camada 1 — RLS por tabela (Fase 2)

Cada tabela de domínio (`membros`, `mensalidades`, `pagamentos`, `fechamentos_mensais`, etc.) tem Row Level Security habilitado, com policies que chamam `public.is_admin()` / `public.is_tesoureiro()` (funções `security definer` definidas em `00000000000002_auth_helpers.sql`). Essa camada protege o acesso via **client autenticado normal** (chave `anon`, sessão do usuário logado): mesmo que alguém contorne a UI e chame a API do Supabase diretamente com o token de sessão, o Postgres recusa a operação se a policy não autorizar.

Detalhes completos de cada policy, por tabela, estão em [`docs/banco.md`](./banco.md).

### Camada 2 — `requireAdmin()` / `requireTesoureiro()` nas Server Actions com `service_role` (Fase 3)

Algumas operações **não podem** ser feitas pelo client normal porque não são um simples INSERT/UPDATE em uma tabela com RLS — são chamadas à Supabase Admin API (`auth.admin.createUser`, `auth.admin.updateUserById`) ou escritas em tabelas que **não têm nenhuma policy de escrita client-side** (`profiles` para criação/edição, `auditoria` para toda escrita). Essas operações são implementadas em Server Actions que usam `createSupabaseServiceRoleClient()` (`lib/supabase/service.ts`), o client com a `service_role` key.

**Por que essa camada existe:** `service_role` **ignora RLS inteiramente** — não é "mais uma policy que autoriza", é uma credencial que faz o Postgres pular a checagem de RLS por completo. Isso significa que, para as operações que passam por esse client (criar usuário, editar `profiles`, gravar `auditoria`, redefinir senha), **a única barreira contra um usuário não autorizado é a própria Server Action** — não existe camada de banco por baixo protegendo essa chamada específica. Por isso toda Server Action que usa `service_role` começa chamando `requireAdmin()` (ou `requireTesoureiro()`, para operações futuras de outros módulos que também precisem do client privilegiado), que:

1. Lê a sessão do usuário chamador com o client **normal** (RLS ligado, `createSupabaseServerClient()`).
2. Busca o `role`/`ativo` desse usuário em `profiles` (uma leitura sujeita a `profiles_select_authenticated`, portanto sempre confiável quanto a "quem está realmente logado").
3. Aplica a regra pura `canAccess()` (`lib/domain/authorization.ts`) — perfil nulo ou `ativo = false` nunca é autorizado; `minimo: 'ADMINISTRADOR'` exige `role === 'ADMINISTRADOR'`; `minimo: 'TESOUREIRO'` aceita `ADMINISTRADOR` ou `TESOUREIRO`.
4. Lança `AuthorizationError` se a checagem falhar — **antes** de qualquer código tocar o client `service_role`.

Somente depois dessa checagem passar a Server Action instancia `createSupabaseServiceRoleClient()` e executa a operação privilegiada.

`lib/supabase/service.ts` reforça essa fronteira estruturalmente: o módulo importa o pacote `server-only`, que faz o **build falhar** se algum código client-side tentar importá-lo por engano — a `service_role` key nunca chega ao bundle do browser (CLAUDE.md §11, princípio 12 do SPEC).

### Onde a Camada 2 se aplica hoje

As quatro Server Actions em `app/(app)/configuracoes/usuarios/actions.ts` (`criarUsuario`, `atualizarUsuario`, `alterarStatusUsuario`, `redefinirSenha`) chamam `requireAdmin()` como primeiro passo, antes de qualquer uso do client `service_role`. A página `app/(app)/configuracoes/usuarios/page.tsx` também revalida o `role` do usuário logado no servidor (via client normal) antes de renderizar a tela — se não for `ADMINISTRADOR`, renderiza `components/AcessoNegado.tsx` em vez do conteúdo da página. `requireTesoureiro()` existe desde já (Task 1) para ser reutilizada por módulos financeiros de fases futuras que também precisem de `service_role`.

---

## Decisões técnicas da Fase 3

Estas quatro decisões (do cabeçalho do plano `docs/superpowers/plans/2026-08-10-fase3-usuarios.md`) afetam diretamente como a autorização e a auditoria de usuários se comportam:

1. **Username é imutável após a criação do usuário.** `atualizarUsuario()` só altera `nome` e `role` — nunca `username`. O motivo é que o username determina o e-mail interno usado no Supabase Auth (`usernameToAuthEmail`, `lib/domain/auth.ts`); sincronizar uma mudança de username com uma mudança de e-mail em `auth.users` introduziria risco de dessincronia sem que o SPEC peça essa funcionalidade. Para trocar o username de alguém, o fluxo é desativar o usuário antigo e criar um novo.

2. **Falha na auditoria não reverte a operação principal já bem-sucedida.** Em `criarUsuario`, `atualizarUsuario`, `alterarStatusUsuario` e `redefinirSenha`, a chamada a `registrarAuditoria()` está em um `try/catch` que apenas loga o erro (`console.error`) caso a gravação em `auditoria` falhe — a Server Action ainda retorna sucesso. Não existe transação cruzando `auth.users` / `profiles` / `auditoria` (são chamadas remotas separadas); reverter uma operação de usuário já concluída com sucesso por causa de uma falha pontual de auditoria seria pior para o usuário final do que aceitar o risco raro de uma linha de auditoria ausente. A exceção é a falha ao criar `profiles` **depois** de já ter criado o `auth.users`: nesse caso `criarUsuario` reverte explicitamente (`auth.admin.deleteUser`), porque deixaria o sistema em um estado inconsistente (login possível sem perfil correspondente).

3. **Administrador não pode desativar a própria conta.** `alterarStatusUsuario()` verifica `admin.id === id && !ativo` e recusa com `'Você não pode desativar seu próprio usuário.'` antes de tocar no banco — trava simples contra lockout total do sistema (se o único Administrador ativo se desativasse, ninguém mais poderia reativá-lo).

4. **Erros do Supabase Auth são repassados com a mensagem original**, sem mapeamento para mensagens específicas por código de erro. Por exemplo, se `auth.admin.createUser` falhar porque o e-mail/username já existe, a Server Action retorna `Falha ao criar usuário: ${createError.message}` com o texto vindo direto do SDK. Essa é uma decisão puramente técnica: mapear cada código de erro do SDK para uma mensagem amigável em português dependeria de comportamento interno não documentado da Admin API, adicionando complexidade sem necessidade real.
