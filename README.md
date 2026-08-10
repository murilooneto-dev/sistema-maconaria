# Sistema Maçonaria

Sistema web profissional para gestão administrativa e financeira de uma Loja Maçônica.

## Stack

- **Framework**: Next.js 16.3.0
- **Linguagem**: TypeScript (strict mode)
- **Estilos**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth
- **Deploy**: Vercel

## Começando

### Instalação

```bash
npm install
```

### Desenvolvimento

Inicia servidor local em `http://localhost:3000`:

```bash
npm run dev
```

### Build

Compila para produção:

```bash
npm run build
npm start
```

### Lint

Valida código com ESLint:

```bash
npm run lint
```

## Configuração

Crie um arquivo `.env.local` baseado em `.env.example` com as credenciais do Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=seu-url-aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-publica-aqui
SUPABASE_SERVICE_ROLE_KEY=sua-chave-privada-aqui
```

## Documentação

- **[SPEC_Loja_Maconica.md](./SPEC_Loja_Maconica.md)** - Especificação completa do sistema
- **[CLAUDE.md](./CLAUDE.md)** - Instruções e regras de desenvolvimento
- **[docs/](./docs/)** - Documentação arquitetural

## Fase de Desenvolvimento

Este projeto está na **Fase 1 — Fundação**.

Roadmap: [PROMPT_INICIAL.md](./PROMPT_INICIAL.md)

## Estrutura do Projeto

```
.
├── app/                  # Next.js App Router
├── public/               # Assets estáticos
├── node_modules/         # Dependências
├── SPEC_Loja_Maconica.md # Especificação
├── CLAUDE.md             # Regras de dev
├── PROMPT_INICIAL.md     # Plano do projeto
└── docs/                 # Documentação adicional
```

## Licença

Privado. Sistema para uso exclusivo da Loja Maçônica.
