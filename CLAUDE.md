# CLAUDE.md — Instruções do Projeto

## 1. Fonte de verdade

O arquivo `SPEC.md` é a especificação oficial do sistema.

Antes de qualquer implementação:

1. Ler `SPEC.md` integralmente.
2. Entender as regras de negócio.
3. Verificar dependências e inconsistências.
4. Nunca substituir uma regra definida no SPEC por uma suposição própria.
5. Se surgir uma dúvida que altere regra financeira, competência, saldo, repasse, histórico ou permissão, parar e perguntar.

Arquivos principais:

- `SPEC.md` — fonte de verdade funcional e técnica.
- `CLAUDE.md` — regras permanentes de desenvolvimento.
- `PROMPT_INICIAL.md` — instruções para inicialização do projeto.

---

## 2. Objetivo do projeto

Construir um sistema web profissional para gestão administrativa e financeira de uma Loja Maçônica.

O sistema controla:

- membros;
- mensalidades;
- inadimplência;
- remidos;
- Grande Loja;
- campanhas;
- doações;
- entradas;
- saídas;
- contas;
- formas de pagamento;
- transferências;
- recibos PDF;
- relatórios;
- fechamento mensal;
- usuários;
- permissões;
- auditoria.

---

## 3. Stack

Utilizar, salvo decisão técnica justificada:

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Vercel
- Git/GitHub

Usar arquitetura moderna, tipada e sustentável.

Evitar dependências desnecessárias.

---

## 4. Regra de ouro

O sistema é financeiro e precisa ser rastreável.

Sempre deve ser possível responder:

- quem pagou;
- quanto pagou;
- quando pagou;
- qual competência quitou;
- quanto pertence à Loja;
- quanto pertence à Grande Loja;
- qual conta recebeu;
- qual forma de pagamento foi usada;
- quem registrou;
- quando registrou;
- se o valor da Grande Loja foi enviado;
- qual competência originou o repasse.

Se uma implementação impedir essa rastreabilidade, ela está errada.

---

## 5. Regras financeiras críticas

### Competência

Competência da mensalidade é diferente da data do pagamento.

Nunca substituir a competência pelo mês em que o pagamento foi realizado.

### Pagamento atrasado

Um pagamento pode quitar várias competências.

Exemplo:

Pagamento em agosto pode quitar abril, maio e junho.

Cada competência permanece individualmente identificável.

### Pagamento parcial

Permitir.

Exemplo:

Devido: R$ 150
Pago: R$ 100
Saldo: R$ 50
Status: PARCIAL.

### Pagamento acima do valor

Permitir, desde que o operador selecione as competências correspondentes.

Nunca criar competência inexistente automaticamente.

### Rateio

Toda competência quitada deve preservar:

- valor total;
- valor Grande Loja;
- valor Loja.

### Grande Loja

O valor da Grande Loja pertence à competência quitada.

Se abril, maio e junho forem pagos em agosto, cada competência gera seu próprio valor de Grande Loja.

### Histórico

Alterar configuração futura nunca altera valores históricos.

---

## 6. Banco de dados

O banco deve ser tratado como parte central do domínio.

Utilizar:

- PostgreSQL;
- migrations versionadas;
- foreign keys;
- constraints;
- índices;
- UUID quando apropriado;
- NUMERIC para dinheiro;
- timestamps;
- status explícitos.

Evitar armazenar informações derivadas de forma redundante quando puderem ser calculadas com segurança.

Porém, valores financeiros históricos que precisam ser preservados devem ser gravados no momento da operação.

Exemplo:

`valor_grande_loja` da competência deve permanecer histórico mesmo que a configuração futura seja alterada.

Nunca criar campos como:

- `janeiro_pago`;
- `fevereiro_pago`;
- `marco_pago`.

Utilizar entidade de mensalidade/competência.

---

## 7. Integridade

Criar constraints para evitar:

- competência duplicada para o mesmo membro;
- valores monetários inválidos;
- transferências para a mesma conta;
- pagamentos sem origem válida;
- referências quebradas;
- registros financeiros inconsistentes.

Uma combinação equivalente a:

`membro_id + ano + mes`

deve ser única em mensalidades.

---

## 8. Financeiro

Movimentações financeiras não devem ser apagadas fisicamente.

Usar status:

- ATIVO;
- CANCELADO.

Ao cancelar:

- registrar usuário;
- registrar data;
- registrar motivo;
- retirar do cálculo financeiro ativo.

Transferências entre contas não são receita nem despesa.

---

## 9. Inadimplência

Regra:

Mais de 6 competências inadimplentes/vencidas = INATIVO.

Ao regularizar:

INATIVO → ATIVO automaticamente.

Essa regra deve estar centralizada em serviço/regra de domínio e possuir testes.

---

## 10. Perfis

### ADMINISTRADOR

Acesso completo.

### TESOUREIRO

Operações financeiras e operacionais conforme SPEC.

### CONSULTA

Somente leitura.

Nunca confiar somente na interface para autorização.

Validar permissões no servidor/banco.

---

## 11. Segurança

Obrigatório:

- Supabase Auth;
- RLS quando aplicável;
- autorização server-side;
- proteção das rotas;
- validação de entrada;
- variáveis de ambiente;
- nenhuma secret no frontend;
- proteção contra acesso indevido;
- auditoria.

Nunca armazenar senha da aplicação em tabela própria.

O usuário utiliza e-mail + senha na interface (SPEC §5; usuários antigos sem e-mail ainda entram com o username), mas a autenticação deve ser implementada de forma segura sobre o mecanismo de autenticação adotado.

---

## 12. Auditoria

Operações críticas devem gerar auditoria.

Registrar quando aplicável:

- usuário;
- módulo;
- ação;
- registro;
- dados anteriores;
- dados novos;
- data/hora;
- descrição.

Especial atenção para:

- pagamentos;
- cancelamentos;
- configurações;
- fechamento;
- reabertura;
- Grande Loja;
- usuários.

---

## 13. UI/UX

Interface:

- moderna;
- profissional;
- limpa;
- responsiva;
- identidade visual da Loja;
- consistente.

Usar componentes reutilizáveis.

Toda tela deve possuir estados apropriados:

- loading;
- vazio;
- erro;
- sucesso;
- confirmação;
- processamento.

Não criar telas visualmente diferentes para operações semelhantes sem motivo.

---

## 14. Desenvolvimento por fases

Não desenvolver tudo de uma vez.

Ordem:

1. Fundação.
2. Banco.
3. Usuários e permissões.
4. Configurações.
5. Membros.
6. Mensalidades.
7. Financeiro.
8. Campanhas.
9. Grande Loja.
10. Recibos.
11. Relatórios.
12. Dashboard.
13. Segurança/revisão.
14. Testes.
15. Deploy.

A fase atual deve estar estável antes da próxima.

---

## 15. Definição de pronto

Uma funcionalidade somente está pronta quando possui:

- interface;
- backend;
- banco;
- validação;
- autorização;
- regra de negócio;
- tratamento de erros;
- auditoria quando aplicável;
- testes;
- documentação quando necessária.

Não considerar uma tela estática como funcionalidade concluída.

Não deixar:

- TODO crítico;
- botão falso;
- mock permanente;
- fluxo incompleto;
- dado fictício mascarando ausência de implementação.

---

## 16. Testes

Prioridade máxima para:

- mensalidades;
- pagamentos;
- inadimplência;
- remidos;
- rateio;
- Grande Loja;
- saldo;
- transferências;
- fechamento;
- cancelamento;
- permissões.

Criar testes unitários e de integração onde fizer sentido.

Testar especialmente cenários de borda.

---

## 17. Código

Preferências:

- TypeScript estrito;
- componentes pequenos;
- funções coesas;
- tipagem forte;
- validação centralizada;
- tratamento explícito de erros;
- nomes claros;
- evitar duplicação;
- evitar abstração prematura.

Não transformar o projeto em uma arquitetura excessivamente complexa sem necessidade.

---

## 18. Documentação

Manter:

```text
/docs
```

Documentar:

- arquitetura;
- banco;
- regras;
- permissões;
- decisões;
- instalação;
- ambiente;
- deploy.

Atualizar documentação quando houver decisão estrutural relevante.

---

## 19. Git

Usar commits pequenos e descritivos.

Evitar commits gigantes que misturam várias fases.

Não commitar:

- `.env`;
- secrets;
- credenciais;
- arquivos sensíveis.

Manter `.env.example`.

---

## 20. Comportamento esperado do Claude Code

Você é o agente principal de desenvolvimento deste projeto.

Seu trabalho é construir o sistema conforme `SPEC.md`.

Não invente regra de negócio.

Não simplifique uma regra financeira crítica.

Não altere o escopo silenciosamente.

Quando uma decisão for puramente técnica, escolha uma solução simples, segura e sustentável e documente.

Quando uma decisão puder alterar o resultado financeiro ou histórico, pergunte antes.

Sempre informe:

1. o que será feito;
2. quais arquivos serão alterados;
3. quais migrations serão criadas;
4. como será testado;
5. resultado da implementação.

Ao terminar uma fase:

- executar testes;
- corrigir erros;
- revisar integração;
- verificar permissões;
- atualizar documentação;
- informar o que foi concluído.

Só avançar para a próxima fase quando a atual estiver funcional.

---

## 21. Prioridades

Em qualquer decisão técnica, priorizar:

1. Integridade financeira.
2. Segurança.
3. Rastreabilidade.
4. Consistência do banco.
5. Manutenção.
6. Simplicidade.
7. Performance.
8. UX.

Nunca sacrificar integridade financeira para facilitar a implementação.

---

## 22. Fonte final

Se houver conflito entre código existente e `SPEC.md`, não alterar a especificação silenciosamente.

Analisar o conflito e comunicar.

O `SPEC.md` é a fonte de verdade do comportamento esperado do sistema.
