alter table public.membros
  add column observacao text;

create table public.anexos (
  id uuid primary key default gen_random_uuid(),
  entidade_tipo text not null check (entidade_tipo in ('MEMBRO', 'PAGAMENTO', 'MOVIMENTACAO')),
  entidade_id uuid not null,
  nome_arquivo text not null,
  path text not null,
  tipo_mime text not null,
  tamanho_bytes bigint not null check (tamanho_bytes > 0),
  enviado_por uuid not null references public.profiles(id),
  criado_em timestamptz not null default now(),
  status text not null default 'ATIVO' check (status in ('ATIVO', 'EXCLUIDO')),
  excluido_por uuid references public.profiles(id),
  excluido_em timestamptz,
  constraint anexos_exclusao_check check (
    (status = 'ATIVO' and excluido_por is null and excluido_em is null)
    or (status = 'EXCLUIDO' and excluido_por is not null and excluido_em is not null)
  )
);

create index anexos_entidade_idx on public.anexos (entidade_tipo, entidade_id);

alter table public.anexos enable row level security;

-- Sem policies de select/insert/delete para authenticated: todo acesso passa
-- por Server Actions com service_role, que decidem autorização em código
-- (mesmo padrão de `auditoria`). RLS habilitada só como defesa em profundidade.

-- Bucket privado (diferente de `loja-assets`, que é público) — download
-- sempre via signed URL de curta duração, gerada sob demanda. Limite de
-- tamanho e MIME types replicados aqui como defesa em profundidade — a
-- validação principal já acontece em lib/anexos/validar-arquivo.ts antes do
-- upload, mas o bucket não deve confiar só na aplicação.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'anexos',
  'anexos',
  false,
  10485760, -- 10MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    -- alguns navegadores/SOs enviam octet-stream genérico para .csv/.xls
    'application/octet-stream'
  ]
)
on conflict (id) do nothing;
