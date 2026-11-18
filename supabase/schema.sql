create table if not exists public.boards (
 id uuid primary key default gen_random_uuid(),
 token_hash text not null unique,
 name text not null default '新しいプロジェクト',
 data jsonb not null default '{"layout":"horizontal","groups":[],"tasks":[]}'::jsonb,
 version bigint not null default 0,
 updated_at timestamptz not null default now()
);
create index if not exists boards_updated_at_idx on public.boards(updated_at);
alter table public.boards enable row level security;
-- No anon policies: all reads/writes go through server-only service role with a token check.
