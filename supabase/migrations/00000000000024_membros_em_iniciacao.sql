-- Membros em processo de iniciação ainda não têm matrícula da Loja. Permite
-- cadastrar sem matrícula (unique continua válido: Postgres trata múltiplos
-- NULL como distintos, então vários membros sem matrícula não colidem) e
-- adiciona uma flag apenas informativa para constar no cadastro.

alter table public.membros
  alter column matricula drop not null;

alter table public.membros
  add column em_iniciacao boolean not null default false;
