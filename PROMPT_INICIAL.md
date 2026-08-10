# PROMPT_INICIAL.md — Inicialização do Projeto

Você está iniciando o desenvolvimento de um sistema web profissional para gestão administrativa e financeira de uma Loja Maçônica.

## PRIMEIRA REGRA

Antes de escrever código, leia integralmente:

1. `SPEC.md`
2. `CLAUDE.md`

Não comece criando telas ou componentes antes dessa leitura.

---

# OBJETIVO

Construir o sistema completo definido no `SPEC.md`.

O sistema terá:

- membros;
- mensalidades;
- inadimplência;
- remidos;
- Grande Loja;
- campanhas;
- doações;
- financeiro;
- contas;
- formas de pagamento;
- transferências;
- recibos PDF;
- relatórios;
- fechamento mensal;
- usuários;
- permissões;
- auditoria.

Stack prevista:

- Next.js;
- TypeScript;
- Tailwind;
- Supabase;
- PostgreSQL;
- Supabase Auth;
- Supabase Storage;
- Vercel.

---

# SUA PRIMEIRA TAREFA

Não implemente o sistema inteiro.

Primeiro faça uma análise técnica do projeto.

Apresente:

1. arquitetura recomendada;
2. estrutura de pastas;
3. entidades do banco;
4. relacionamentos;
5. estratégia de autenticação;
6. estratégia de autorização;
7. estratégia de RLS;
8. estratégia de migrations;
9. estratégia de geração de PDF;
10. estratégia de exportação Excel;
11. principais riscos técnicos;
12. dependências necessárias;
13. plano de execução por fases.

Depois disso, verifique se existem inconsistências reais no SPEC.

Se houver uma inconsistência que possa alterar regra financeira, pergunte antes de implementar.

Se não houver bloqueio, prossiga para a FASE 1.

---

# FASE 1 — FUNDAÇÃO

Implementar somente:

- inicialização do projeto;
- Next.js;
- TypeScript;
- Tailwind;
- estrutura base;
- configuração Supabase;
- variáveis de ambiente;
- layout principal;
- sidebar;
- header;
- tema visual;
- login;
- proteção de rotas;
- estrutura inicial de autorização.

Ainda NÃO implementar:

- mensalidades;
- financeiro;
- campanhas;
- Grande Loja;
- relatórios completos.

Esses módulos serão implementados nas fases seguintes.

---

# REGRAS DURANTE A IMPLEMENTAÇÃO

## 1. Não usar mocks permanentes

Pode usar dados temporários somente para desenvolvimento visual, mas eles devem ser removidos antes da conclusão da fase.

## 2. Não criar botão falso

Todo botão implementado deve possuir comportamento real ou ser explicitamente identificado como parte ainda não implementada.

## 3. Não inventar regra

Se algo estiver definido no SPEC, seguir exatamente.

Se algo não estiver definido e for puramente técnico, tomar decisão técnica razoável.

Se alterar regra financeira, perguntar.

## 4. Segurança

Nunca colocar secrets no frontend.

Não armazenar senha própria.

Aplicar autorização no servidor.

## 5. Banco

Não criar tabelas de maneira improvisada.

As migrations devem ser versionadas.

## 6. Código

Manter TypeScript estrito.

Evitar duplicação.

Criar componentes reutilizáveis.

---

# AO FINAL DA FASE 1

Executar:

- lint;
- typecheck;
- testes existentes;
- build.

Corrigir todos os erros.

Depois apresentar:

### IMPLEMENTADO

Lista objetiva.

### ARQUIVOS CRIADOS/ALTERADOS

Lista.

### BANCO

Migrations criadas.

### TESTES

Resultado.

### PENDÊNCIAS

Somente se existirem.

### PRÓXIMA FASE

Explicar o que será desenvolvido na FASE 2.

Não avançar automaticamente para uma fase posterior sem concluir a atual.

---

# IMPORTANTE

O projeto deve ser tratado como software de produção.

Não faça uma demonstração superficial.

Não crie uma interface bonita com backend incompleto.

Não crie banco simplificado apenas para fazer a tela funcionar.

A integridade dos dados e das regras financeiras é prioridade absoluta.

Comece lendo `SPEC.md` e `CLAUDE.md`.
