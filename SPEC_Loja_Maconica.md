# SPEC.md — Sistema Web de Gestão da Loja Maçônica

**Versão:** 1.0  
**Status:** Especificação funcional e técnica para desenvolvimento  
**Fonte de verdade:** este documento deve ser lido antes de qualquer implementação.

---

# 1. Visão geral

Desenvolver um sistema web profissional para gestão administrativa e financeira de uma Loja Maçônica.

O sistema deverá controlar:

- membros;
- mensalidades;
- inadimplência;
- membros remidos;
- valores destinados à Grande Loja;
- campanhas de arrecadação;
- doações;
- entradas;
- saídas;
- contas financeiras;
- formas de pagamento;
- transferências entre contas;
- recibos em PDF;
- relatórios;
- fechamento mensal;
- usuários e permissões;
- auditoria.

## Infraestrutura

- Sistema web em domínio próprio.
- Frontend/backend web hospedado na Vercel.
- Banco PostgreSQL via Supabase.
- Supabase Auth.
- Supabase Storage para logo e assinatura.
- Git/GitHub para versionamento.

## Stack proposta

- Next.js
- TypeScript
- Tailwind CSS
- Componentes UI consistentes e acessíveis
- Supabase
- PostgreSQL
- Vercel
- Geração de PDF
- Exportação para Excel

A solução deverá ser desenvolvida como produto real, não como protótipo descartável.

---

# 2. Princípios obrigatórios

1. O banco de dados é parte central do sistema e deve preservar histórico financeiro.
2. Regras financeiras não podem existir somente no frontend.
3. Valores monetários devem utilizar `NUMERIC/DECIMAL` no PostgreSQL.
4. Não excluir fisicamente movimentações financeiras.
5. Operações críticas devem possuir auditoria.
6. Alterações de configuração não podem alterar competências históricas.
7. Competência da mensalidade e data efetiva do pagamento são informações diferentes.
8. O valor destinado à Grande Loja deve permanecer vinculado à competência que originou o valor.
9. Usuários Consulta não podem executar operações administrativas apenas manipulando requisições.
10. Permissões devem ser validadas no servidor/banco, além da interface.
11. Não armazenar senhas em tabelas próprias.
12. Não expor secrets do Supabase no frontend.
13. Utilizar migrations versionadas.
14. Não usar mocks permanentes na aplicação final.
15. Não deixar botões sem funcionalidade.
16. Não implementar regras de negócio não definidas sem documentar a decisão.
17. Quando houver ambiguidade que possa alterar uma regra financeira, interromper a implementação daquela regra e solicitar decisão.

---

# 3. Perfis de usuário

## Administrador

Acesso completo.

Pode:

- administrar usuários;
- alterar configurações;
- gerenciar membros;
- gerenciar mensalidades;
- registrar/cancelar operações;
- gerenciar financeiro;
- gerenciar campanhas;
- gerar recibos;
- gerar relatórios;
- fechar e reabrir períodos;
- visualizar auditoria;
- administrar contas e formas de pagamento.

## Tesoureiro

Pode:

- consultar membros;
- registrar pagamentos;
- controlar mensalidades;
- controlar financeiro;
- registrar entradas;
- registrar saídas;
- registrar transferências;
- administrar campanhas conforme permissões;
- gerar recibos;
- gerar relatórios;
- realizar fechamento mensal conforme regra definida.

Não pode:

- administrar usuários;
- alterar configurações administrativas;
- reabrir fechamento mensal.

## Consulta

Somente leitura.

Pode:

- visualizar dashboard;
- visualizar membros;
- visualizar mensalidades;
- visualizar campanhas;
- visualizar financeiro;
- visualizar relatórios;
- visualizar Grande Loja;
- visualizar recibos.

Não pode:

- criar;
- editar;
- cancelar;
- registrar pagamentos;
- alterar configurações.

---

# 4. Layout geral

## Estrutura

Sidebar:

- Dashboard
- Membros
- Mensalidades
- Campanhas
- Financeiro
- Grande Loja
- Recibos
- Relatórios
- Configurações

Header:

- logo da Loja;
- nome da Loja;
- usuário logado;
- perfil;
- sair.

A interface deve ser:

- moderna;
- profissional;
- limpa;
- responsiva;
- com identidade visual da Loja;
- sem excesso de elementos temáticos.

---

# 5. Autenticação

Tela `/login`.

Campos:

- usuário;
- senha.

Botão:

- Entrar.

O usuário utilizará username + senha na interface.

A autenticação deve ser implementada de forma segura utilizando Supabase Auth, criando uma camada de associação entre username e a identidade de autenticação do Supabase.

Não armazenar senha própria em tabela da aplicação.

Proteger todas as rotas privadas.

---

# 6. Membros

## Campos

- Nome
- Telefone
- Matrícula
- Do Quadro
- Remido
- Recolhe
- Situação
- Observação (texto livre, opcional)
- Anexos (arquivos: PDF, JPEG, PNG, Word, CSV, XLS/XLSX — múltiplos por membro, ver §11)

### Regras

`Do Quadro` indica simplesmente se a pessoa pertence atualmente ao quadro da Loja.

`Remido` indica que o membro utiliza valores específicos de mensalidade e Grande Loja.

`Recolhe` é um campo booleano simples. Não criar regras adicionais sem solicitação.

Situação:

- ATIVO
- INATIVO

Não apagar membro que deixou de pertencer ao quadro.

Ao sair:

`do_quadro = false`

O histórico permanece.

---

# 7. Inadimplência

A situação será calculada a partir das competências de mensalidade.

Regra:

> Mais de 6 competências inadimplentes/vencidas = INATIVO.

Quando pagamentos forem registrados posteriormente e a situação for regularizada:

> INATIVO → ATIVO automaticamente.

O cálculo deve ser centralizado e testado.

---

# 8. Mensalidades

Tela `/mensalidades`.

Permitir seleção de ano.

Exemplo:

`2026`

Exibir:

- janeiro;
- fevereiro;
- março;
- abril;
- maio;
- junho;
- julho;
- agosto;
- setembro;
- outubro;
- novembro;
- dezembro.

Visualização:

`MEMBRO | JAN | FEV | MAR | ABR | MAI | JUN | JUL | AGO | SET | OUT | NOV | DEZ`

Cada competência deve ser uma entidade própria.

Não criar campos fixos `janeiro_pago`, `fevereiro_pago` etc. na tabela de membros.

## Status

- PENDENTE
- PARCIAL
- QUITADA
- CANCELADA
- NAO_APLICAVEL

## Cada competência deve preservar

- membro;
- ano;
- mês;
- competência;
- valor devido;
- valor Grande Loja;
- valor Loja;
- valor pago;
- saldo;
- status;
- data de quitação.

---

# 9. Valores de mensalidade

Existem dois grupos.

## Membro normal

- valor mensal;
- valor Grande Loja.

## Membro remido

- valor mensal;
- valor Grande Loja.

Os valores são configuráveis.

Ao criar uma nova competência, o sistema deve gravar os valores aplicáveis naquele momento.

Se a configuração mudar posteriormente, competências antigas permanecem inalteradas.

Exemplo:

Janeiro: R$ 100  
Abril: nova configuração R$ 120

Janeiro continua R$ 100.

---

# 10. Novo membro

O novo membro começa a gerar mensalidade no mês seguinte ao cadastro.

Exemplo:

Cadastro em 15/08/2026.

Primeira competência:

09/2026.

Agosto não deve gerar cobrança.

---

# 11. Pagamentos

O sistema deve permitir:

- pagamento integral;
- pagamento parcial;
- pagamento de várias competências;
- pagamento de competências atrasadas;
- pagamento acima do valor de uma competência.

Ao registrar pagamento, o operador selecionará as competências que estão sendo quitadas.

## Exemplo

04/2026 = R$ 150  
05/2026 = R$ 150  
06/2026 = R$ 150

Pagamento em agosto:

R$ 450.

O sistema deverá vincular um único pagamento às três competências.

## Anexos

Ao registrar um pagamento (mensalidade) ou uma movimentação financeira manual (entrada/saída em `Financeiro > Nova movimentação`), o operador pode anexar um ou mais comprovantes (PDF, JPEG, PNG, Word, CSV, XLS/XLSX, até 10MB cada). Falha ao enviar um anexo não impede nem reverte o pagamento/movimentação já registrado — é um dado auxiliar do comprovante, não um dado financeiro crítico (decisão adicionada em 2026-08-13, a pedido do usuário).

---

# 12. Pagamento parcial

Exemplo:

Valor devido: R$ 150  
Valor pago: R$ 100  
Saldo: R$ 50

Status:

`PARCIAL`

O sistema deve impedir:

- valores negativos;
- pagamento sem membro válido;
- pagamento sem competência;
- inconsistência entre total informado e competências selecionadas.

---

# 13. Pagamento acima do valor

Se o pagamento for superior ao valor de uma competência, o sistema deve permitir que o operador selecione quais competências estão sendo quitadas.

Não criar automaticamente competência inexistente apenas porque o valor recebido é maior.

---

# 14. Rateio da mensalidade

Ao quitar uma competência:

`VALOR TOTAL = VALOR GRANDE LOJA + VALOR LOJA`

Exemplo:

Mensalidade: R$ 150  
Grande Loja: R$ 50  
Loja: R$ 100

Para remido, utilizar os valores de remido.

O rateio deve ser preservado no histórico.

---

# 15. Regra crítica da Grande Loja

A competência da mensalidade e a data do pagamento são conceitos independentes.

Exemplo:

Pagamento realizado em agosto/2026:

- 04/2026;
- 05/2026;
- 06/2026.

O sistema deve registrar:

- pagamento em agosto/2026;
- competência 04/2026;
- competência 05/2026;
- competência 06/2026;
- valor Grande Loja de cada competência.

Nunca substituir a competência pela data do pagamento.

## Consequência

Se o membro paga atrasados em agosto:

04/2026 → valor GL  
05/2026 → valor GL  
06/2026 → valor GL

Esses valores passam a compor o conjunto de valores de Grande Loja a serem considerados no ciclo de envio.

---

# 16. Relatório Grande Loja

Tela `/grande-loja`.

Filtro:

- mês/ano do envio.

Mostrar:

- membro;
- competência de referência;
- valor Grande Loja;
- situação.

Exemplo:

| Membro | Competência | Valor GL | Situação |
|---|---|---:|---|
| João | 04/2026 | R$ 50,00 | Pendente |
| Pedro | 06/2026 | R$ 50,00 | Pendente |
| Carlos | 07/2026 | R$ 50,00 | Pendente |

Resumo:

- total de membros;
- total de itens;
- total a enviar;
- enviados;
- pendentes.

## Status

- PENDENTE
- ENVIADO
- CANCELADO

Ao marcar como enviado:

- data;
- usuário;
- valor total;
- itens;
- observação.

Preservar histórico.

O relatório deve permitir:

- visualizar;
- gerar PDF;
- exportar Excel.

---

# 17. Financeiro

Tela `/financeiro`.

## Entradas

- Mensalidade
- Tronco
- Campanha
- Recebimentos

## Saídas

- Despesas
- Custos
- Pagamentos avulsos

Toda movimentação deve possuir:

- data;
- tipo;
- categoria;
- descrição;
- valor;
- conta;
- forma de pagamento;
- membro, quando aplicável;
- campanha, quando aplicável;
- usuário responsável;
- origem;
- status;
- observação;
- timestamps.

---

# 18. Contas financeiras

Contas são independentes.

Exemplos:

- Caixa;
- Caixa Tronco;
- Banco do Brasil;
- outras contas.

`Caixa Tronco` não é uma categoria. É uma conta própria.

Cada conta terá:

- nome;
- descrição;
- saldo inicial;
- data do saldo inicial;
- ativo/inativo.

---

# 19. Formas de pagamento

Cadastro:

- Dinheiro;
- PIX;
- Transferência;
- Cartão;
- Boleto;
- Outros.

Permitir cadastro de novas formas.

---

# 20. Transferência entre contas

Criar operação específica:

Origem  
Destino  
Valor  
Data  
Observação  
Usuário

Transferência não é receita nem despesa operacional.

---

# 21. Saldo inicial

Permitir configurar saldo inicial por conta.

Exemplo:

Caixa: R$ 5.000  
Caixa Tronco: R$ 800

O saldo inicial não é uma receita.

---

# 22. Fechamento mensal

Tela `/financeiro/fechamento`.

Mostrar:

- saldo inicial;
- entradas;
- saídas;
- transferências;
- saldo final.

Ao fechar:

- bloquear alterações normais daquele período;
- permitir reabertura somente pelo Administrador;
- registrar reabertura na auditoria.

---

# 23. Cancelamento

Movimentações financeiras não devem ser apagadas fisicamente.

Usar:

- ATIVO
- CANCELADO

Registrar:

- usuário;
- data;
- motivo.

Canceladas não entram em saldos ou relatórios ativos.

---

# 24. Campanhas

Tela `/campanhas`.

Visualização em cards.

Campos:

- título;
- objetivo;
- meta;
- pessoa ajudada;
- contato;
- endereço;
- descrição;
- data inicial;
- data final;
- status.

Status:

- EM_ANDAMENTO;
- CONCLUIDA;
- CANCELADA.

Ao atingir a meta:

`EM_ANDAMENTO → CONCLUIDA`

Permitir reabertura.

---

# 25. Doações

Uma doação pode vir de:

- membro;
- pessoa externa.

Campos:

- campanha;
- doador;
- membro opcional;
- valor;
- data;
- conta;
- forma de pagamento;
- observação;
- usuário;
- status.

A doação deve:

1. registrar o recebimento;
2. alimentar o financeiro;
3. atualizar o progresso da campanha.

---

# 26. Dashboard

Tela `/dashboard`.

Cards:

- total de membros;
- ativos;
- inativos;
- inadimplentes;
- entradas do período;
- saídas do período;
- saldo consolidado.

Componentes:

- gráfico entradas x saídas;
- saldos por conta;
- campanhas em andamento;
- últimas movimentações.

Permitir filtro de período quando aplicável.

---

# 27. Recibos

Tela `/recibos`.

Tipos:

- Mensalidade;
- Campanha.

Gerar PDF.

Dados:

- logo;
- nome da Loja;
- pessoa;
- valor;
- referência;
- data;
- descrição;
- assinatura.

Assinatura será imagem configurada.

Cargo fixo:

**Venerável Mestre**

Data:

`DD/MM/YYYY`

Manter histórico dos recibos.

---

# 28. Configurações

## Loja

- nome;
- logo.

## Mensalidade normal

- valor;
- valor Grande Loja.

## Remido

- valor;
- valor Grande Loja.

## Recibo

- assinatura.

Cargo fixo: Venerável Mestre.

## Contas

CRUD.

## Formas de pagamento

CRUD.

## Usuários

CRUD administrativo.

---

# 29. Relatórios

Criar:

1. Resumo de membros.
2. Resumo geral de campanhas.
3. Resumo de campanha específica.
4. Movimentação de entradas e saídas.
5. Relatório Grande Loja.
6. Saldos por conta.
7. Mensalidades/inadimplência.

Relatórios relevantes devem permitir:

- tela;
- PDF;
- Excel.

Filtros financeiros:

- período;
- tipo;
- categoria;
- conta;
- forma de pagamento;
- membro;
- campanha.

---

# 30. Auditoria

Tabela de auditoria deverá registrar operações críticas.

Campos:

- usuário;
- módulo;
- ação;
- registro;
- dados anteriores;
- dados novos;
- descrição;
- data/hora.

Exemplos:

- criação;
- edição;
- cancelamento;
- pagamento;
- fechamento;
- reabertura;
- alteração de configuração;
- repasse Grande Loja;
- administração de usuário.

---

# 31. Modelo de dados

Criar migrations para entidades equivalentes a:

- `users/profiles`
- `loja_config`
- `config_mensalidade`
- `membros`
- `mensalidades`
- `pagamentos`
- `pagamento_mensalidades`
- `contas`
- `formas_pagamento`
- `movimentacoes`
- `transferencias`
- `campanhas`
- `doacoes`
- `recibos`
- `fechamentos_mensais`
- `repasses_grande_loja`
- `repasses_grande_loja_itens`
- `auditoria`

## Relacionamentos essenciais

### Usuário

Usuário → Auditoria  
Usuário → Pagamentos  
Usuário → Movimentações  
Usuário → Recibos  
Usuário → Repasses  
Usuário → Fechamentos

### Membro

Membro → Mensalidades  
Membro → Pagamentos  
Membro → Doações quando aplicável  
Membro → Recibos  
Membro → Movimentações quando aplicável

### Mensalidade

Mensalidade → Pagamento através de `pagamento_mensalidades`  
Mensalidade → Repasse Grande Loja através de `repasses_grande_loja_itens`

### Campanha

Campanha → Doações  
Campanha → Movimentações

### Conta

Conta → Movimentações  
Conta → Transferências

---

# 32. Regras de integridade

Criar:

- foreign keys;
- constraints;
- índices;
- unicidade quando aplicável;
- validação de valores monetários;
- validação de competências;
- prevenção de duplicidade de mensalidade por membro/ano/mês;
- prevenção de transferência para a mesma conta;
- integridade de pagamentos.

Uma competência não pode existir duas vezes para o mesmo membro, ano e mês.

---

# 33. Estrutura de rotas

```text
/login

/dashboard

/membros
/membros/novo
/membros/[id]

/mensalidades
/mensalidades/pagamento

/campanhas
/campanhas/nova
/campanhas/[id]

/financeiro
/financeiro/entradas
/financeiro/saidas
/financeiro/contas
/financeiro/formas-pagamento
/financeiro/transferencias
/financeiro/fechamento

/grande-loja

/recibos

/relatorios
/relatorios/membros
/relatorios/campanhas
/relatorios/financeiro
/relatorios/grande-loja
/relatorios/mensalidades

/configuracoes
/configuracoes/loja
/configuracoes/mensalidades (inclui configuração de Remidos)
/configuracoes/contas
/configuracoes/formas-pagamento
/configuracoes/usuarios
/configuracoes/recibo
```

---

# 34. Wireframes funcionais

## Login

Logo  
Nome da Loja  
Usuário  
Senha  
Entrar

## Dashboard

Cards + gráficos + campanhas + últimas movimentações + saldos.

## Membros

Tabela com:

- nome;
- telefone;
- matrícula;
- quadro;
- remido;
- recolhe;
- situação;
- ações.

Filtros:

- nome;
- situação;
- quadro;
- remido;
- recolhe.

## Detalhes do membro

- dados;
- situação;
- mensalidades;
- financeiro;
- recibos;
- histórico.

## Mensalidades

Tabela anual por membro.

Legenda:

- quitada;
- parcial;
- pendente;
- não aplicável.

## Registro de pagamento

Selecionar membro → competências → valor → data → conta → forma → confirmação.

## Campanhas

Cards com meta, arrecadado, saldo, percentual e status.

## Financeiro

Filtros + tabela de movimentações + totais.

## Grande Loja

Filtros + itens por membro + competência + valor + situação + totais + PDF + Excel + marcar enviado.

## Recibos

Tipo + pessoa + referência + valor + data + gerar PDF + histórico.

## Relatórios

Cards por relatório + filtros + visualização + exportações.

## Configurações

Seções independentes.

---

# 35. Regras automáticas

O sistema deve automaticamente:

1. Criar competências conforme regras de entrada do membro.
2. Usar valores normais/remidos conforme cadastro.
3. Preservar valores históricos.
4. Calcular inadimplência.
5. Alterar situação para INATIVO quando aplicável.
6. Reativar automaticamente quando regularizado.
7. Calcular rateio Loja/Grande Loja.
8. Atualizar financeiro após pagamento.
9. Atualizar progresso de campanhas.
10. Concluir campanha ao atingir meta.
11. Atualizar saldos.
12. Respeitar fechamentos mensais.
13. Gerar informações para relatório Grande Loja.
14. Registrar auditoria.

---

# 36. Testes obrigatórios

Criar testes automatizados e testes funcionais para:

1. pagamento integral;
2. pagamento parcial;
3. pagamento de várias competências;
4. pagamento atrasado;
5. pagamento acima de uma competência;
6. inadimplência superior a seis meses;
7. reativação;
8. mudança para remido;
9. alteração de configuração sem alterar histórico;
10. novo membro;
11. rateio Grande Loja;
12. relatório Grande Loja;
13. repasse marcado como enviado;
14. campanha atingindo meta;
15. transferência entre contas;
16. saldo inicial;
17. fechamento;
18. reabertura;
19. cancelamento;
20. permissões dos três perfis.

---

# 37. Fases de desenvolvimento

## Fase 1 — Fundação

- projeto;
- arquitetura;
- ambiente;
- autenticação;
- layout;
- rotas;
- proteção.

## Fase 2 — Banco

- migrations;
- tabelas;
- constraints;
- índices;
- RLS;
- seeds.

## Fase 3 — Usuários

- perfis;
- permissões;
- auditoria.

## Fase 4 — Configurações

- Loja;
- mensalidade;
- remido;
- Grande Loja;
- contas;
- formas;
- recibo.

## Fase 5 — Membros

- CRUD;
- histórico;
- situação;
- inadimplência.

## Fase 6 — Mensalidades

- competências;
- geração;
- pagamentos;
- parcial;
- atrasados;
- rateio.

## Fase 7 — Financeiro

- entradas;
- saídas;
- contas;
- transferências;
- saldos;
- fechamento.

## Fase 8 — Campanhas

- campanhas;
- doações;
- progresso;
- conclusão/reabertura.

## Fase 9 — Grande Loja

- cálculo;
- relatório;
- repasse;
- status;
- histórico.

## Fase 10 — Recibos

- PDF;
- assinatura;
- histórico.

## Fase 11 — Relatórios

- membros;
- campanhas;
- financeiro;
- mensalidades;
- Grande Loja.

## Fase 12 — Dashboard

Utilizar dados reais.

## Fase 13 — Segurança

Revisar RLS, autorização, rotas, API, secrets e auditoria.

## Fase 14 — Testes

Executar testes de todas as regras críticas.

## Fase 15 — Deploy

- GitHub;
- Vercel;
- Supabase;
- domínio;
- variáveis;
- produção.

---

# 38. Critério de conclusão

Uma funcionalidade só está concluída quando possuir:

- interface;
- backend;
- banco;
- validação;
- autorização;
- regra de negócio;
- tratamento de erro;
- auditoria quando aplicável;
- testes;
- documentação quando necessária.

Não considerar "tela pronta" como "funcionalidade pronta".

---

# 39. Documentação do projeto

Criar:

```text
/docs
```

Com:

- arquitetura;
- banco;
- regras de negócio;
- permissões;
- instalação;
- variáveis de ambiente;
- deploy;
- migrations;
- decisões técnicas.

Criar também:

`README.md`

---

# 40. Instrução final para o agente de desenvolvimento

Antes de programar:

1. Ler este `SPEC.md` integralmente.
2. Identificar dependências.
3. Verificar possíveis inconsistências.
4. Criar plano de execução.
5. Implementar somente a fase atual.
6. Testar.
7. Corrigir.
8. Documentar.
9. Só então avançar.

Não desenvolver tudo de uma vez.

Não alterar regras de negócio por conta própria.

Não criar funcionalidades fora do escopo sem justificar.

Quando a dúvida puder alterar cálculo financeiro, competência, saldo, repasse ou histórico, solicitar decisão antes de implementar.

Quando a decisão for apenas técnica e não alterar a regra de negócio, escolher a solução mais simples, segura, sustentável e documentar.

A prioridade é:

1. Integridade financeira.
2. Segurança.
3. Rastreabilidade.
4. Consistência do banco.
5. Manutenção.
6. Experiência do usuário.

## Regra de ouro

O sistema deve sempre conseguir responder:

- quem pagou;
- quanto pagou;
- quando pagou;
- qual competência quitou;
- quanto pertence à Loja;
- quanto pertence à Grande Loja;
- qual conta recebeu;
- qual forma de pagamento foi usada;
- quem registrou;
- quando foi registrado;
- se o valor da Grande Loja já foi enviado;
- qual competência originou o repasse.

Se o sistema não conseguir responder essas perguntas, a implementação financeira está incompleta.
