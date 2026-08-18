# Editar Movimentação Financeira — Design

Data: 2026-08-18

## Contexto

Hoje o Financeiro só permite **registrar** e **cancelar** movimentações (`app/(app)/financeiro/actions.ts`). Não existe "editar": se o operador digitar um valor errado e finalizar, o único caminho é cancelar a movimentação (com motivo obrigatório) e criar uma nova do zero, refazendo todos os campos manualmente.

O padrão de cancelamento já existente (`cancelarMovimentacao`) nunca apaga fisicamente um registro — marca `status = 'CANCELADO'`, grava `motivo_cancelamento`, `cancelado_por`, `cancelado_em`, e gera auditoria. Esse padrão é o que garante a regra de ouro do CLAUDE.md (§4): sempre ser possível responder quem, quanto, quando, em qual conta, etc.

Este documento cobre **só a tabela `movimentacoes`** (entradas/saídas avulsas do Financeiro), na tela `/financeiro` — decisão explícita do usuário para manter o escopo pequeno. Editar pagamento de mensalidade, doação de campanha ou transferência entre contas fica fora deste documento (podem ser propostas futuras, com seus próprios desenhos, dado que pagamento de mensalidade em particular tem lógica bem mais complexa — rateio de Grande Loja, competências, locks de concorrência).

## Objetivo

Adicionar um botão **"Editar"** na tabela de Movimentações (`MovimentacoesTable.tsx`), ao lado do "Cancelar" já existente, que permite corrigir uma movimentação lançada com erro sem perder o rastro do valor original.

## Mecanismo: cancelar + recriar (decisão do usuário)

"Editar" não faz `UPDATE` nos campos do registro existente. Por baixo dos panos:

1. Um novo registro de movimentação é criado com os valores corrigidos (`status = 'ATIVO'`, `origem = 'MANUAL'`).
2. O registro antigo é cancelado atomicamente (mesma trava condicional `.eq('status', 'ATIVO')` já usada em `cancelarMovimentacao`), com `motivo_cancelamento` preenchido automaticamente indicando que foi uma edição e qual o motivo informado pelo operador.
3. Se o cancelamento do registro antigo falhar (ex.: concorrência — outra operação cancelou a mesma movimentação entre a criação da nova e a tentativa de cancelar a antiga), a movimentação nova recém-criada é apagada para não deixar duplicidade — mesmo padrão de compensação já usado em `compensarFalhaParcial` (`app/(app)/mensalidades/pagamento/actions.ts`).

Essa escolha (em vez de `UPDATE` direto nos campos) foi feita porque:

- Reaproveita 100% a lógica de cancelamento já existente, testada e auditada — nenhuma regra financeira nova é inventada.
- Preserva o registro antigo intacto e consultável (inclusive seus anexos/comprovantes), com o motivo da correção.
- Mantém consistência com o resto do sistema, que já trata "correção" de dados financeiros como cancelamento + novo lançamento (é o mesmo raciocínio usado em pagamento de mensalidade).

## Rastreabilidade: nova coluna `editada_de_id`

Migration nova, adicionando à tabela `movimentacoes`:

```sql
alter table public.movimentacoes
  add column editada_de_id uuid references public.movimentacoes(id);

create index movimentacoes_editada_de_idx on public.movimentacoes (editada_de_id);
```

A movimentação **nova** grava `editada_de_id = <id da antiga>`. Isso permite, a partir de qualquer movimentação, navegar a cadeia de edições diretamente por SQL/join, sem depender só de parsear o texto de `motivo_cancelamento`. Não há coluna inversa (`substituida_por_id`) — a movimentação antiga (cancelada) pode ser localizada a partir da nova via `editada_de_id`; o caminho inverso (achar a "filha" de uma cancelada) é uma consulta simples (`where editada_de_id = <id_antiga>`), sem necessidade de manter os dois lados sincronizados.

## Regras e restrições

- **Permissão:** só Tesoureiro/Administrador (mesma checagem `requireTesoureiro()` do resto do módulo).
- **Quando o botão aparece:** só quando `status === 'ATIVO'` e `origem !== 'MENSALIDADE'` — mesma condição já usada para exibir "Cancelar" hoje (`MovimentacoesTable.tsx:106`). Movimentação gerada automaticamente por pagamento de mensalidade continua fora deste fluxo (mensagem "via Mensalidades" já existente permanece).
- **Período fechado:** bloqueado se o período (mês/ano) da movimentação **antiga** já estiver fechado (`periodoEstaFechado`, mesma checagem do cancelamento). A data da movimentação **nova** pode cair num período fechado — mesma regra já vigente para lançamentos manuais retroativos (decisão registrada na migration 20: "Criação de novo lançamento retroativo continua permitida").
- **Motivo obrigatório:** a edição exige um campo "Motivo da edição" (texto livre, obrigatório), igual ao motivo de cancelamento hoje.
- **Categoria:** mesma validação já usada em `registrarMovimentacao` — a categoria selecionada precisa ter `tipo` compatível, `sistema = false` e `ativo = true`.
- **Anexos:** não são copiados automaticamente da movimentação antiga para a nova. O comprovante antigo continua acessível na movimentação cancelada (histórico preservado); se quiser, o operador anexa de novo na nova movimentação.

## Interface

### Reaproveitamento do formulário existente

`NovaMovimentacaoForm` (`app/(app)/financeiro/nova/NovaMovimentacaoForm.tsx`) passa a servir tanto para criar quanto para editar, evitando duas telas visualmente diferentes para operações semelhantes (CLAUDE.md §13):

- Recebe props opcionais: `modoEdicao?: { movimentacaoId: string; valoresIniciais: {...} }`.
- Em modo edição: título muda para "Editar movimentação", todos os campos vêm pré-preenchidos (`defaultValue`) com os valores atuais, aparece o campo obrigatório "Motivo da edição", o botão de submit chama a nova action `editarMovimentacao` (em vez de `registrarMovimentacao`) e o texto do botão muda para "Salvar edição".
- Em modo normal (criação): comportamento idêntico ao atual, sem nenhuma mudança visível.

### Nova rota `/financeiro/[id]/editar`

Página server component nova, no mesmo padrão de `app/(app)/financeiro/nova/page.tsx`:

- Verifica autenticação e papel (Tesoureiro/Administrador), senão `<AcessoNegado />`.
- Busca a movimentação pelo `id` da URL. Se não existir, `status !== 'ATIVO'` ou `origem === 'MENSALIDADE'`, mostra mensagem de erro (não deveria ser alcançável pela UI, mas a rota precisa se proteger de acesso direto por URL).
- Busca as mesmas listas auxiliares da tela de criação (categorias, contas, formas de pagamento, membros).
- Renderiza `<NovaMovimentacaoForm ... modoEdicao={{ movimentacaoId, valoresIniciais }} />`.

### Botão "Editar" em `MovimentacoesTable.tsx`

Ao lado do botão "Cancelar" existente, um link `<Link href={`/financeiro/${mov.id}/editar`}>Editar</Link>`, com a mesma condição de visibilidade (`status === 'ATIVO' && origem !== 'MENSALIDADE'`).

## Camada de dados (`app/(app)/financeiro/actions.ts`)

Nova função `editarMovimentacao(_prevState, formData)`, seguindo o mesmo formato de `ActionState` das outras actions do arquivo:

1. `requireTesoureiro()`.
2. Lê `movimentacaoId` (campo hidden do form) e os mesmos campos de `registrarMovimentacao` (data, tipo, categoriaId, descricao, valor, contaId, formaPagamentoId, membroId, observacao), mais `motivoEdicao` (obrigatório, não pode ser vazio).
3. `validarMovimentacao(...)` — mesma validação de domínio já usada na criação.
4. Busca a movimentação antiga (`id, status, origem, data, tipo, categoria_id, descricao, valor, conta_id, forma_pagamento_id, membro_id`). Se não encontrada, retorna erro. Se `status !== 'ATIVO'`, retorna "Esta movimentação já foi cancelada ou editada.". Se `origem === 'MENSALIDADE'`, retorna a mesma mensagem que `cancelarMovimentacao` já usa hoje.
5. Se `periodoEstaFechado(supabaseAdmin, antiga.data)`, retorna "Não é possível editar: o período desta movimentação já está fechado."
6. Valida a categoria nova (mesma checagem de `registrarMovimentacao`).
7. Insere a movimentação nova com `editada_de_id = antiga.id`.
8. Se a inserção falhar, retorna erro (nada foi tocado ainda na antiga).
9. Tenta cancelar a antiga atomicamente (`.eq('id', antiga.id).eq('status', 'ATIVO')`, gravando `motivo_cancelamento = "Editada — substituída pela movimentação {novoId}. Motivo: {motivoEdicao}"`, `cancelado_por`, `cancelado_em`).
10. Se o cancelamento da antiga falhar (0 linhas afetadas — concorrência), apaga a movimentação nova recém-criada e retorna erro "Esta movimentação foi alterada por outra operação simultânea. Tente novamente.".
11. Registra auditoria (`acao: 'EDICAO_MOVIMENTACAO'`, `dadosAnteriores`: snapshot da movimentação antiga, `dadosNovos`: valores novos + `{ movimentacaoAntigaId, movimentacaoNovaId }`).
12. Faz upload dos anexos do formulário (se houver) vinculados à movimentação **nova**, mesmo helper `uploadAnexosDoFormulario` já usado em `registrarMovimentacao`.
13. `revalidatePath('/financeiro')`.
14. Retorna sucesso.

## Testes

- Teste unitário: nenhuma regra de domínio nova é introduzida (`validarMovimentacao` já é testada); a lógica de `editarMovimentacao` é majoritariamente orquestração de I/O, então a cobertura principal vem de verificação manual + revisão de código, seguindo o padrão já usado para `cancelarMovimentacao`/`registrarMovimentacao` (que também não têm testes unitários próprios, pois são thin wrappers de I/O sobre lógica de domínio já testada).
- Verificação manual: editar uma movimentação, conferir que a antiga aparece como "Cancelada" com o motivo correto, que a nova aparece como "Ativa" com os valores corrigidos, que os totais de entrada/saída da tela batem com a nova (não contam a antiga cancelada), e que tentar editar uma movimentação de origem MENSALIDADE ou já cancelada não mostra o botão.

## Arquivos afetados

Novos:
- `supabase/migrations/00000000000028_movimentacoes_edicao.sql`
- `app/(app)/financeiro/[id]/editar/page.tsx`

Alterados:
- `app/(app)/financeiro/actions.ts` (nova função `editarMovimentacao`)
- `app/(app)/financeiro/nova/NovaMovimentacaoForm.tsx` (suporte a modo edição)
- `app/(app)/financeiro/MovimentacoesTable.tsx` (botão "Editar")

## Fora de escopo

- Editar pagamento de mensalidade, doação de campanha ou transferência entre contas (telas separadas, ficam para propostas futuras).
- Copiar anexos da movimentação antiga para a nova automaticamente.
- Interface para visualizar a cadeia completa de edições de uma movimentação (a coluna `editada_de_id` já viabiliza isso tecnicamente, mas a tela de histórico/timeline fica para uma proposta futura, se necessário).
