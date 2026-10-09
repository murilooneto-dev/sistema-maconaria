-- E-mail real do usuário, usado para recuperação de senha ("Esqueci minha
-- senha" na tela de login). Opcional: quem não tem e-mail cadastrado
-- continua autenticando pelo e-mail interno "<username>@loja.internal" e só
-- recupera a senha por redefinição feita por um Administrador.
--
-- Quando preenchido, o mesmo endereço é gravado em auth.users.email pela
-- aplicação (app/(app)/configuracoes/usuarios/actions.ts) — é para ele que
-- o Supabase Auth envia o link de recuperação. O login continua sendo por
-- username: a aplicação resolve username → e-mail de autenticação.
alter table public.profiles
  add column email text
    check (email = lower(email) and email like '%_@_%' and email not like '%@loja.internal');

create unique index profiles_email_idx on public.profiles (email) where email is not null;
