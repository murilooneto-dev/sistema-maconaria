# Arquitetura

## Overview

Este documento descreve a estrutura de pastas, o fluxo de autenticação e os módulos de negócio implementados nas Fases 1–6 do sistema. Para o schema do banco de dados e políticas de RLS, ver [`docs/banco.md`](./banco.md).

---

## Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript** (modo estrito).
- **Tailwind CSS 4** para estilos.
- **Supabase** (PostgreSQL + Supabase Auth) como backend.
- **Vitest** para testes unitários.
- **ESLint** (`eslint-config-next`) para lint.
- **pdf-lib** para geração de PDF (recibos, Fase 10) — gerado sob demanda a partir dos dados gravados, não fica armazenado em Storage.

---

## Estrutura de pastas

```
.
├── app/
│   ├── layout.tsx                # Layout raiz (fonte, html/body)
│   ├── page.tsx                  # Rota "/" (redireciona incondicionalmente para /dashboard; o middleware trata o redirect para /login quando não há sessão)
│   ├── login/
│   │   ├── page.tsx              # Tela de login (formulário username/senha)
│   │   └── actions.ts            # Server Actions: signIn(), signOut()
│   └── (app)/                    # Route group autenticado
│       ├── layout.tsx            # Verifica sessão, carrega profile, monta Sidebar+Header
│       ├── dashboard/                 # Dashboard com dados reais — Fase 12
│       │   ├── page.tsx                # Cards (membros/financeiro), filtro de período, saldos, campanhas, últimas movimentações
│       │   └── GraficoEntradasSaidas.tsx # Gráfico de barras SVG puro (sem dependência nova) — últimos 6 meses
│       ├── membros/
│       │   ├── page.tsx               # Lista de membros com filtros (Server Component, leitura liberada a todo autenticado) — Fase 5
│       │   ├── actions.ts             # Server Actions: criarMembro, atualizarMembro (admin-only via requireAdmin) — Fase 5
│       │   ├── novo/
│       │   │   ├── page.tsx           # Formulário de criação (Server Component, admin-only) — Fase 5
│       │   │   └── NovoMembroForm.tsx # Formulário (Client Component, useActionState) — Fase 5
│       │   ├── importar/              # Importação em lote via CSV (admin-only)
│       │   │   ├── page.tsx           # Instruções de formato + formulário
│       │   │   ├── ImportarCsvForm.tsx # Upload + resumo (criados/duplicados/inválidos) (Client Component)
│       │   │   └── actions.ts         # Server Action: importarMembros() — mesma validação e geração de competências de criarMembro
│       │   └── [id]/
│       │       ├── page.tsx           # Detalhe de membro (Server Component, leitura liberada a todo autenticado; botão Editar só para admin) — Fase 5
│       │       └── MembroDetalhe.tsx  # Detalhe + edição inline (Client Component, useState/useTransition) — Fase 5
│       ├── mensalidades/              # Módulo de Mensalidades — Fase 6
│       │   ├── page.tsx                # Lista de membros com grade mensal de competências e status (Server Component, TESOUREIRO+)
│       │   ├── actions.ts              # Server Actions: gerarMensalidades(), registrarPagamento(), cancelarPagamento()
│       │   ├── GerarMensalidadesButton.tsx # Botão para gerar competências (Client Component, admin-only)
│       │   └── pagamento/
│       │       ├── page.tsx                # Fluxo de registro de pagamento (Server Component, formulário interativo)
│       │       ├── actions.ts              # Server Action: registrarPagamentoMensalidade() — único caminho de escrita de pagamentos
│       │       ├── SelecionarMembro.tsx    # Client Component: dropdown de membros + cálculo dinâmico de saldos
│       │       ├── PagamentoForm.tsx       # Client Component: seleção de competências + valores + forma de pagamento + conta
│       │       └── HistoricoPagamentos.tsx # Client Component: tabela de histórico de pagamentos do membro
│       ├── campanhas/                 # Módulo Campanhas — Fase 8
│       │   ├── page.tsx                # Cards (meta/arrecadado/saldo/percentual/status) — Server Component
│       │   ├── actions.ts              # Server Actions: criarCampanha, atualizarCampanha, concluirCampanha, cancelarCampanha, reabrirCampanha
│       │   ├── nova/                   # Formulário de criação
│       │   └── [id]/                   # Detalhe: doações, nova doação (vincula financeiro), cancelar doação, editar, mudar status
│       │       └── actions.ts          # Server Actions: registrarDoacao(), cancelarDoacao()
│       ├── financeiro/                # Módulo Financeiro — Fase 7
│       │   ├── FinanceiroTabs.tsx      # Navegação entre as 5 sub-telas (Client Component)
│       │   ├── page.tsx                # Visão geral: dashboard de entradas/saídas por centro de custo (Server Component)
│       │   ├── CentrosDeCustoGrid.tsx  # Cards de resumo por centro de custo (Client Component)
│       │   ├── actions.ts              # Server Actions: registrarMovimentacao(), cancelarMovimentacao()
│       │   ├── movimentacoes/          # Movimentações: filtros + tabela + totais (Server Component)
│       │   ├── MovimentacoesTable.tsx  # Tabela com cancelamento (Client Component)
│       │   ├── nova/                   # Lançamento manual (Tronco/Recebimentos/Despesas/Custos/Avulsos)
│       │   ├── transferencias/         # Server Actions registrarTransferencia()/cancelarTransferencia() + tela
│       │   └── fechamento/             # Fechamento mensal: preview do período candidato, fechar (tesoureiro), reabrir (admin, só o mais recente)
│       ├── grande-loja/               # Módulo Grande Loja — Fase 9
│       │   ├── page.tsx                # Resumo + itens pendentes + histórico de repasses (Server Component)
│       │   ├── actions.ts              # Server Actions: marcarComoEnviado(), cancelarRepasse()
│       │   ├── ItensPendentesForm.tsx  # Seleção de itens PENDENTE + envio (Client Component)
│       │   └── HistoricoRepasses.tsx   # Histórico filtrável por mês/ano + cancelar (Client Component)
│       ├── recibos/                   # Módulo Recibos — Fase 10
│       │   ├── page.tsx                # Histórico + filtros (tipo/período/pessoa) + link "Baixar PDF" (Server Component)
│       │   ├── actions.ts              # Server Action: gerarRecibo() — a partir de um pagamento (Mensalidade) ou doação (Campanha)
│       │   ├── [id]/pdf/route.ts       # Route Handler: gera o PDF sob demanda (não fica armazenado em Storage)
│       │   └── novo/                   # Fluxo de seleção (membro→pagamento ou campanha→doação) + geração
│       ├── relatorios/                # Módulo Relatórios — Fase 11
│       │   ├── page.tsx                # Hub de cards (7 relatórios do SPEC §29)
│       │   ├── ResultadoRelatorioView.tsx # Tabela + resumo + links de export (compartilhado pelos 6 relatórios)
│       │   ├── membros/                # Resumo de membros — page.tsx + pdf/route.ts + csv/route.ts
│       │   ├── campanhas/              # Resumo geral OU campanha específica (?campanhaId=) — mesma rota cobre os 2 itens do SPEC
│       │   ├── financeiro/             # Movimentação de entradas e saídas (filtros: período/tipo/categoria/conta/forma/membro/campanha — SPEC §29)
│       │   ├── grande-loja/            # Relatório Grande Loja (filtro mês/ano do envio + situação)
│       │   ├── saldos/                 # Saldos por conta (sem filtros)
│       │   └── mensalidades/           # Mensalidades / Inadimplência
│       └── configuracoes/
│           ├── page.tsx          # Hub de configurações (links para os submódulos, todos habilitados desde a Fase 4)
│           ├── usuarios/
│           │   ├── page.tsx           # Lista de usuários (Server Component, checa role=ADMINISTRADOR)
│           │   ├── actions.ts         # Server Actions: criarUsuario, atualizarUsuario, alterarStatusUsuario, redefinirSenha
│           │   ├── NovoUsuarioForm.tsx# Formulário de criação (Client Component, useActionState)
│           │   └── UsuariosTable.tsx  # Tabela de usuários com ações de editar/ativar-desativar/redefinir senha
│           ├── loja/
│           │   ├── page.tsx           # Edição de nome + logo da Loja (Server Component, admin-only)
│           │   ├── LojaForm.tsx       # Formulário (Client Component, useActionState) com upload de logo
│           │   └── actions.ts         # Server Action atualizarLoja() — upload em loja-assets/logo via service_role
│           ├── mensalidades/
│           │   ├── page.tsx           # Valor vigente + histórico de config_mensalidade (tipo NORMAL)
│           │   └── actions.ts         # Server Action salvarConfigMensalidade() — insert-only (histórico preservado)
│           ├── remidos/
│           │   └── page.tsx           # Mesma tela/lógica de mensalidades, filtrada para tipo REMIDO (reusa ConfigMensalidadeForm); não tem actions.ts próprio — reusa ../mensalidades/actions.ts
│           ├── contas/
│           │   ├── page.tsx           # Lista de contas (Server Component, admin-only)
│           │   ├── ContasTable.tsx    # Tabela com toggle ativo/inativo (sem delete físico)
│           │   ├── NovaContaForm.tsx  # Formulário de criação (Client Component, useActionState)
│           │   └── actions.ts         # Server Actions: criarConta, atualizarConta
│           ├── formas-pagamento/
│           │   ├── page.tsx                    # Lista de formas de pagamento (Server Component, admin-only)
│           │   ├── FormasPagamentoTable.tsx     # Tabela com toggle ativo/inativo (sem delete físico)
│           │   ├── NovaFormaPagamentoForm.tsx   # Formulário de criação (Client Component, useActionState)
│           │   └── actions.ts                  # Server Actions: criarFormaPagamento, atualizarFormaPagamento
│           ├── recibo/
│           │   ├── page.tsx           # Edição da assinatura usada nos recibos (Server Component, admin-only)
│           │   ├── AssinaturaForm.tsx # Formulário (Client Component, useActionState) com upload de assinatura
│           │   └── actions.ts         # Server Action atualizarAssinatura() — upload em loja-assets/assinaturas via service_role
│           ├── categorias/            # Categorias de movimentação (Entrada/Saída) — Fase 7, admin-only
│           │   ├── page.tsx           # Lista (categoria "Mensalidade" é de sistema, não editável)
│           │   ├── CategoriasTable.tsx
│           │   ├── NovaCategoriaForm.tsx
│           │   └── actions.ts         # Server Actions: criarCategoria, atualizarCategoria
│           └── centros-de-custo/      # Centros de custo (agrupamento de categorias) — admin-only
│               ├── page.tsx           # Lista de centros de custo (Server Component)
│               ├── CentrosDeCustoList.tsx # Tabela com toggle ativo/inativo e vínculo de categorias (Client Component)
│               ├── NovoCentroForm.tsx # Formulário de criação (Client Component, useActionState)
│               └── actions.ts         # Server Actions: criarCentroDeCusto, atualizarCentroDeCusto, atualizarCategoriasDoCentro
├── components/
│   ├── AcessoNegado.tsx          # Mensagem padrão de "sem permissão" para páginas restritas por role
│   ├── configuracoes/
│   │   └── ConfigMensalidadeForm.tsx  # Formulário compartilhado pelas seções Normal e Remidos em /configuracoes/mensalidades (Client Component)
│   └── layout/
│       ├── Sidebar.tsx           # Navegação lateral fixa (links para os módulos)
│       └── Header.tsx            # Cabeçalho: nome/role do usuário logado + botão Sair
├── lib/
│   ├── audit.ts                  # registrarAuditoria() — único caminho de escrita em `auditoria` (via service_role)
│   ├── auth/
│   │   └── require-role.ts       # requireAdmin(), requireTesoureiro(), AuthorizationError
│   ├── domain/
│   │   ├── auth.ts               # normalizeUsername(), usernameToAuthEmail()
│   │   ├── auth.test.ts          # Testes unitários do mapeamento username→email
│   │   ├── authorization.ts      # canAccess() — regra pura de decisão de autorização por role
│   │   ├── authorization.test.ts # Testes unitários de canAccess()
│   │   ├── configuracoes.ts      # validarLoja(), validarConfigMensalidade(), validarConta(), validarFormaPagamento()
│   │   ├── configuracoes.test.ts # Testes unitários das validações de Configurações
│   │   ├── usuarios.ts           # validarNovoUsuario(), validarEdicaoUsuario()
│   │   ├── usuarios.test.ts      # Testes unitários de validação de usuário
│   │   ├── membros.ts            # validarMembro() — Fase 5
│   │   ├── membros-import.ts     # parseCsvMembros() — parse + validação de CSV de importação em lote (reusa validarMembro por linha)
│   │   ├── membros.test.ts       # Testes unitários de validação de membros — Fase 5
│   │   ├── inadimplencia.ts      # calcularSituacaoMembro(), contarCompetenciasVencidasNaoPagas() — centraliza regra de 6+ competências vencidas — Fases 5–6
│   │   ├── inadimplencia.test.ts # Testes unitários de cálculo de inadimplência — Fases 5–6
│   │   ├── competencias.ts       # proximaCompetenciaAposCadastro(), competenciasFaltantes(), dataVencimento() — SPEC §10 — Fase 6
│   │   ├── competencias.test.ts  # Testes unitários de cálculo de competências — Fase 6
│   │   ├── pagamentos.ts         # validarAlocacoes(), calcularNovoStatusMensalidade() — SPEC §11–13 — Fase 6
│   │   ├── pagamentos.test.ts    # Testes unitários de validação de pagamentos — Fase 6
│   │   ├── financeiro.ts         # validarMovimentacao(), validarTransferencia(), calcularSaldoConta(), calcularFechamento(), podeFecharPeriodo(), podeReabrir() — Fase 7
│   │   ├── campanhas.ts          # validarCampanha(), validarDoacao(), calcularArrecadado(), calcularPercentual(), deveConcluirAutomaticamente() — Fase 8
│   │   ├── grande-loja.ts        # calcularTotal(), validarSelecaoRepasse() — Fase 9
│   │   └── recibos.ts            # validarGeracaoRecibo() — Fase 10
│   ├── mensalidades/
│   │   └── recalcular-situacao.ts # recalcularSituacaoMembro() — centraliza sincronização de situação após pagamento/cancelamento — Fase 6
│   ├── campanhas/                # Fase 8
│   │   └── recalcular-status.ts  # recalcularStatusCampanha() — EM_ANDAMENTO → CONCLUIDA automático ao atingir a meta (nunca reabre sozinho)
│   ├── grande-loja/              # Fase 9
│   │   └── sincronizar-item.ts   # sincronizarItemGrandeLoja() — cria/cancela item de repasse conforme a mensalidade fica QUITADA/deixa de estar; chamada de dentro de registrarPagamento/cancelarPagamento (Fase 6)
│   ├── pdf/
│   │   ├── recibo.ts             # gerarPdfRecibo() — monta o PDF (pdf-lib): cabeçalho logo+nome, tabela de dados, assinatura — Fase 10
│   │   ├── imagens.ts            # buscarImagemStorage() — baixa logo/assinatura do Storage, identifica PNG/JPEG pelos bytes reais (não pela extensão) — Fase 10
│   │   └── tabela.ts             # gerarPdfTabela() — PDF tabular genérico e paginado (A4 paisagem), reusado pelos 6 relatórios — Fase 11
│   ├── financeiro/               # Fase 7
│   │   ├── constantes.ts         # CATEGORIA_MENSALIDADE_ID, CATEGORIA_CAMPANHA_ID, CATEGORIA_GRANDE_LOJA_ID — UUIDs fixos das categorias de sistema
│   │   ├── periodo.ts            # periodoEstaFechado() — checagem de fechamento em código de aplicação (usado por pagamentos, movimentações e transferências)
│   │   ├── fechamento.ts         # obterUltimoFechado(), obterRegistroPeriodo(), cálculo de saldo inicial/totais de um período
│   │   ├── movimentacao-pagamento.ts # criarMovimentacaoPagamento()/cancelarMovimentacaoPagamento() — vínculo entre pagamento de mensalidade e financeiro
│   │   ├── movimentacao-doacao.ts    # criarMovimentacaoDoacao()/cancelarMovimentacaoDoacao() — vínculo entre doação e financeiro — Fase 8
│   │   └── movimentacao-repasse.ts   # criarMovimentacaoRepasse()/cancelarMovimentacaoRepasse() — vínculo entre repasse à Grande Loja (SAIDA) e financeiro — Fase 9
│   ├── format.ts                 # formatarDataBR() — formata date do Postgres (YYYY-MM-DD) para DD/MM/YYYY — Fase 9
│   ├── csv.ts                    # gerarCsv() — CSV genérico (separador `;`, BOM UTF-8) para exportação "Excel" — Fase 11
│   ├── relatorios/               # Fase 11 — cada arquivo é a ÚNICA fonte de dados usada pela tela e pelos exports PDF/CSV do relatório
│   │   ├── tipos.ts              # ResultadoRelatorio — formato comum (titulo, resumo, colunas, linhas)
│   │   ├── query.ts              # paramsParaQueryString() — preserva os filtros da tela nos links de export
│   │   ├── membros.ts            # buscarRelatorioMembros()
│   │   ├── campanhas.ts          # buscarRelatorioCampanhas() — geral OU específica (SPEC §29 itens 2 e 3), conforme campanhaId
│   │   ├── financeiro.ts         # buscarRelatorioFinanceiro() — movimentação de entradas e saídas com os 7 filtros do SPEC §29
│   │   ├── grande-loja.ts        # buscarRelatorioGrandeLoja()
│   │   ├── saldos.ts             # buscarRelatorioSaldos() — reusa calcularSaldoConta() da Fase 7
│   │   └── mensalidades.ts       # buscarRelatorioMensalidades() — reusa contarCompetenciasVencidasNaoPagas() da Fase 5/6
│   ├── dashboard/                 # Fase 12
│   │   └── dados.ts              # buscarDadosDashboard() — cards, gráfico, saldos, campanhas e últimas movimentações num único fetch
│   └── supabase/
│       ├── client.ts             # createSupabaseBrowserClient() — uso em Client Components
│       ├── server.ts             # createSupabaseServerClient() — uso em Server Components/Actions
│       ├── service.ts            # createSupabaseServiceRoleClient() — client service_role, protegido por `server-only`
│       └── middleware.ts         # updateSession() — validação/refresh de sessão a cada request
├── proxy.ts                      # Proxy do Next.js (antigo middleware.ts), delega para lib/supabase/middleware.ts
├── supabase/
│   ├── migrations/
│   │   ├── 00000000000001_profiles.sql  # Tabela profiles + RLS + trigger updated_at
│   │   ├── ...                          # Migrations 2–15 (Fases 1–2, ver docs/banco.md)
│   │   ├── 00000000000016_loja_assets.sql # Fase 4: loja_config.assinatura_url + bucket de Storage loja-assets
│   │   ├── 00000000000017_loja_config_seed.sql # Fase 4 (fix): garante linha singleton de loja_config
│   │   ├── 00000000000018_assinaturas_privadas.sql # Fase 4 (fix): bucket privado loja-assinaturas
│   │   ├── 00000000000019_config_mensalidade_append_only.sql # Fase 4 (fix): trigger que bloqueia UPDATE/DELETE em config_mensalidade
│   │   ├── 00000000000020_financeiro_fase7.sql # Fase 7: categorias_movimentacao (+ trigger de categoria de sistema), movimentacoes.categoria → categoria_id, trigger de bloqueio de cancelamento em período fechado
│   │   ├── 00000000000021_campanhas_fase8.sql # Fase 8: seed da categoria de sistema "Campanha" (ENTRADA) em categorias_movimentacao
│   │   └── 00000000000022_grande_loja_fase9.sql # Fase 9: repasses_grande_loja.conta_id, movimentacoes.repasse_grande_loja_id, seed da categoria de sistema "Grande Loja" (SAIDA)
│   └── seed.sql                  # dados de desenvolvimento (formas de pagamento padrão, config inicial da loja)
├── docs/
│   ├── arquitetura.md            # Este arquivo
│   ├── banco.md                  # Schema, RLS, constraints, decisões de design
│   ├── permissoes.md             # Matriz de permissões por perfil e as duas camadas de enforcement (RLS + requireAdmin/requireTesoureiro)
│   └── instalacao.md             # Passo a passo de setup local
├── SPEC_Loja_Maconica.md         # Especificação funcional/técnica (fonte de verdade)
├── CLAUDE.md                     # Regras permanentes de desenvolvimento
├── PROMPT_INICIAL.md             # Roadmap/fases do projeto
└── .env.example                  # Variáveis de ambiente necessárias
```

Não existem ainda camadas de `services/`, `repositories/` ou APIs REST customizadas — toda a lógica de servidor da Fase 1 está em Server Actions (`app/login/actions.ts`) e em funções puras de domínio (`lib/domain/`). Módulos de negócio das fases seguintes devem seguir o mesmo padrão: regra de domínio isolada em `lib/domain/`, acesso a dados via Supabase client apropriado (`server.ts` no servidor, `client.ts` no browser).

---

## Fluxo de autenticação

O sistema usa **username + senha** na interface, mas a autenticação real é feita pelo Supabase Auth, que trabalha com e-mail. Não existe tabela própria de senhas — ver `CLAUDE.md` §11.

Passo a passo:

1. **Usuário digita username e senha** em `/login` (`app/login/page.tsx`), um formulário que invoca a Server Action `signIn` (`app/login/actions.ts`) via `useActionState`/`action`.

2. **Mapeamento username → e-mail interno.** `signIn()` chama `usernameToAuthEmail(username)` em `lib/domain/auth.ts`, que normaliza o username (`trim` + `lowercase`) e monta `"<username>@loja.internal"`. Esse domínio fictício existe apenas para satisfazer o requisito de e-mail do Supabase Auth — o usuário nunca vê nem usa esse e-mail.

3. **Autenticação no Supabase Auth.** `signIn()` cria um client Supabase de servidor (`createSupabaseServerClient()`, `lib/supabase/server.ts`) e chama `supabase.auth.signInWithPassword({ email, password })`. Em caso de erro, retorna `{ error: 'Usuário ou senha inválidos.' }` para o formulário (mensagem genérica, sem revelar se o problema foi o username ou a senha).

4. **Cookie de sessão.** O client de servidor (`@supabase/ssr`) grava os cookies de sessão (access/refresh token) na resposta via `cookieStore.set()`. Em caso de sucesso, `signIn()` redireciona para `/dashboard`.

5. **Proxy (middleware) valida a sessão a cada request.** `proxy.ts` (raiz — o antigo `middleware.ts`, renomeado por conta da convenção introduzida no Next.js 16) delega para `updateSession()` em `lib/supabase/middleware.ts`, que roda em todo request (exceto assets estáticos, conforme `config.matcher`). Ele:
   - cria um client Supabase de servidor ligado aos cookies do request/response;
   - chama `supabase.auth.getUser()` para validar/renovar a sessão;
   - se não há usuário autenticado e a rota não é `/login`, redireciona para `/login`;
   - se há usuário autenticado e a rota é `/login`, redireciona para `/dashboard`;
   - propaga os cookies atualizados (refresh de token) tanto na resposta normal quanto nos redirects.

6. **Layout autenticado revalida no servidor.** `app/(app)/layout.tsx` (que envolve todas as rotas do route group `(app)`) roda em cada navegação e, independentemente do middleware, verifica novamente `supabase.auth.getUser()` — se não houver usuário, redireciona para `/login`. Essa dupla checagem segue a regra de "nunca confiar somente na interface para autorização" (CLAUDE.md §10): o middleware é uma otimização/gate de borda, mas a autorização real é sempre revalidada no servidor.

7. **Carregamento do perfil.** Ainda em `app/(app)/layout.tsx`, com o `user.id` validado, o layout busca a linha correspondente em `public.profiles` (`select('nome, role')... eq('id', user.id).single()`). Esses dados alimentam o `Header` (nome exibido, role exibida) e, futuramente, checagens de autorização por papel.

8. **RLS como última linha de defesa.** A tabela `profiles` tem Row Level Security habilitado (`supabase/migrations/00000000000001_profiles.sql`). Qualquer usuário autenticado pode fazer `SELECT` (policy `profiles_select_authenticated`), mas não existe nenhuma policy de `INSERT`/`UPDATE`/`DELETE` client-side — mesmo que alguém obtivesse o client anon key e tentasse escrever diretamente na tabela, o banco recusaria. Escrita em `profiles` só acontece via Server Action com `service_role` (a ser implementada na Fase 3, junto com CRUD de usuários). Detalhes completos do schema e das políticas estão em [`docs/banco.md`](./banco.md).

9. **Logout.** `signOut()` (`app/login/actions.ts`), invocado pelo botão "Sair" no `Header`, chama `supabase.auth.signOut()` (limpando os cookies de sessão) e redireciona para `/login`.

Resumo em uma linha:

```
username → usernameToAuthEmail() → Supabase Auth (signInWithPassword) → cookie de sessão
   → middleware (getUser em toda request) → layout (app) (getUser + profiles) → RLS (profiles)
```

### Perfis e autorização

A tabela `profiles` guarda `username`, `nome`, `role` (`ADMINISTRADOR` | `TESOUREIRO` | `CONSULTA`) e `ativo`. Na Fase 1, o `role` é apenas exibido no `Header` — não há ainda enforcement de permissões por ação nas telas (essas telas de módulo são placeholders até a Fase 2 em diante). A validação de autorização granular por perfil, conforme CLAUDE.md §10, deve ser implementada em cada módulo de negócio nas fases seguintes, sempre no servidor.

---

## Variáveis de ambiente

Ver `.env.example` na raiz e `docs/instalacao.md` para o passo a passo de configuração:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (reservada para uso futuro em Server Actions administrativas; ainda não consumida por código na Fase 1)

---

## Módulos implementados

- **Fase 1 (Fundação):** autenticação, profiles, layout autenticado, RLS, Supabase Auth.
- **Fases 2–4 (Configurações):** loja, usuários, mensalidades, remidos, contas, formas de pagamento, recibo.
- **Fase 5 (Membros):** CRUD de membros, filtros, cálculo de inadimplência centralizado, validações.
- **Fase 6 (Mensalidades):** geração de competências, registro de pagamento (integral/parcial/múltiplas competências/atrasadas), cancelamento de pagamento, cálculo dinâmico de saldo, recalcular situação de membro (ATIVO/INATIVO), auditoria de pagamentos.
- **Fase 7 (Financeiro):** categorias de movimentação editáveis (`categorias_movimentacao`, categoria de sistema "Mensalidade" protegida por trigger), lançamentos manuais (Tronco/Recebimentos/Despesas/Custos/Pagamentos avulsos), vínculo automático entre pagamento de mensalidade e movimentação (criado ao registrar, cancelado ao cancelar o pagamento), transferências entre contas, saldo de conta calculado on-the-fly (nunca armazenado), fechamento mensal (saldo inicial encadeado ao fechamento anterior, sequência obrigatória, reabertura só pelo Administrador e só no fechamento mais recente). Cancelamento de movimentação/transferência num período fechado é bloqueado tanto em código quanto por trigger de banco (`bloqueia_cancelamento_periodo_fechado`); para pagamentos de mensalidade a checagem é só em código de aplicação (`periodoEstaFechado`), pra não colidir com o fluxo de compensação automática da Fase 6. **Sem testes automatizados nesta fase** — validação combinada com o usuário para ser manual (decisão registrada em 2026-08-12).

- **Fase 8 (Campanhas):** CRUD de campanhas (cards com meta/arrecadado/saldo/percentual/status), registro de doação (membro ou pessoa externa) com vínculo automático ao financeiro (movimentação ENTRADA/Campanha, criada ao registrar e cancelada ao cancelar a doação), conclusão automática ao atingir a meta (`EM_ANDAMENTO → CONCLUIDA`), conclusão/cancelamento/reabertura manuais. **Sem testes automatizados**, mesmo padrão da Fase 7.

- **Fase 9 (Grande Loja):** criação de itens em `repasses_grande_loja_itens` (antes deliberadamente fora de escopo, Fase 2) — todo item PENDENTE é criado/cancelado automaticamente conforme a mensalidade correspondente fica QUITADA ou deixa de estar (`sincronizarItemGrandeLoja`, chamada de dentro de `registrarPagamento`/`cancelarPagamento`, non-fatal). Tela `/grande-loja` com resumo, seleção de itens pendentes e "marcar como enviado" (decisão do usuário, 2026-08-12: isso gera uma movimentação **SAIDA** real no financeiro, debitando a conta escolhida — dinheiro de Grande Loja acumulado no saldo da Loja passa a sair de fato do caixa). Cancelar um repasse reabre os itens (voltam a PENDENTE) e cancela a movimentação vinculada. Um item já ENVIADO não é revertido automaticamente se o pagamento de mensalidade original for cancelado depois — limitação conhecida, documentada em código, requer conferência manual. **Sem PDF/Excel** (fica para a Fase 11 — Relatórios) e **sem testes automatizados**, mesmo padrão das Fases 7–8.

- **Fase 10 (Recibos):** geração de recibo (Mensalidade a partir de um pagamento ATIVO, Campanha a partir de uma doação ATIVA) com PDF gerado sob demanda via Route Handler (`/recibos/[id]/pdf`, `pdf-lib`) — não armazenado em Storage, recriado a cada download a partir dos dados gravados em `recibos` e da assinatura/logo vigentes na época (a `assinatura_url` é congelada no momento da geração, preservando o histórico mesmo que a assinatura configurada mude depois). Cargo fixo "Venerável Mestre", data em DD/MM/YYYY (`formatarDataBR`). Sem edição/exclusão de recibo (só `INSERT`/`SELECT` no banco — reemitir uma segunda via cria um novo registro). **Sem testes automatizados**, mesmo padrão das Fases 7–9.

- **Fase 11 (Relatórios):** os 7 relatórios do SPEC §29 (membros, campanhas geral, campanha específica, financeiro, Grande Loja, saldos por conta, mensalidades/inadimplência), cada um com tela + export PDF (`gerarPdfTabela`, tabular genérico e paginado) + export "Excel" (CSV com separador `;` e BOM UTF-8, `gerarCsv`) — decisão técnica: CSV em vez de `.xlsx` real para não adicionar uma dependência pesada (`xlsx`/`exceljs`) nesta fase; Excel abre `.csv` nativamente. Cada relatório tem um único módulo em `lib/relatorios/` que busca os dados uma vez e alimenta tela, PDF e CSV — evita divergência entre o que a tela mostra e o que é exportado. Resumo geral e campanha específica são a mesma rota (`/relatorios/campanhas`), alternando pelo parâmetro `campanhaId`. **Sem testes automatizados**, mesmo padrão das Fases 7–10.

- **Fase 12 (Dashboard):** `lib/dashboard/dados.ts` (`buscarDadosDashboard`) busca tudo em uma função só — cards (total/ativos/inativos de membros do quadro, inadimplentes via `contarCompetenciasVencidasNaoPagas`, entradas/saídas do período filtrável, saldo consolidado via `calcularSaldoConta`), gráfico de entradas x saídas dos últimos 6 meses (fixo, independente do filtro de período), saldos por conta, campanhas em andamento (via `calcularArrecadado`/`calcularPercentual`) e últimas 8 movimentações. Gráfico é SVG puro embutido (`GraficoEntradasSaidas.tsx`) — sem adicionar biblioteca de charts. Roadmap de 15 fases encerrado aqui: Fases 14 (Testes) e 15 (Deploy formal) descartadas pelo usuário em 2026-08-13 — sistema já em produção com domínio próprio e uso diário real. Fase 13 (Segurança/revisão) é a última planejada.

## Fora de escopo (Fase 11)

Conforme `PROMPT_INICIAL.md`: Fase 12 (Dashboard com dados reais), Fase 13 (revisão de segurança) e Fase 14 (testes) ainda não foram feitas.
