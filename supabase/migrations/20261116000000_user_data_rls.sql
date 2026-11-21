-- Versioned schema and Row Level Security (RLS) migration for public.user_data
-- NOTE: public.user_data is shared by three apps: Global Command Center (gcc-preferences),
-- GloPo Companion (e.g. glopo-practice-lab), and AHSAS (e.g. ahsas_research_studio).
-- The 1 MB (1048576 bytes) value size cap prevents silently dropping larger student saves.
-- Safe and idempotent on both fresh databases and the live production table
-- (which already carries PRIMARY KEY (id) and UNIQUE (user_id, key)).
-- Replaces all legacy public-role policies with authenticated-only policies atomically
-- inside a single transaction so there is zero gap in RLS protection.

begin;

create table if not exists public.user_data (
    user_id uuid not null references auth.users(id) on delete cascade,
    key text not null,
    value jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    primary key (user_id, key)
);

alter table public.user_data
    add column if not exists updated_at timestamptz not null default now();

do $$
begin
    -- Respect an existing PRIMARY KEY (id) + UNIQUE (user_id, key) without dropping the PK;
    -- add UNIQUE (user_id, key) only if neither a PK nor a UNIQUE constraint covers (user_id, key)
    -- so upsert(..., { onConflict: 'user_id,key' }) always works.
    if not exists (
        select 1
        from pg_constraint c
        where c.conrelid = 'public.user_data'::regclass
          and c.contype in ('p', 'u')
          and (
              select array_agg(a.attname::text order by u.ord)
              from unnest(c.conkey) with ordinality as u(attnum, ord)
              join pg_attribute a
                on a.attrelid = c.conrelid
               and a.attnum = u.attnum
          ) = array['user_id', 'key']
    ) then
        alter table public.user_data
            add constraint user_data_user_id_key_unique unique (user_id, key);
    end if;

    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.user_data'::regclass and conname = 'user_data_key_length_check'
    ) then
        alter table public.user_data
            add constraint user_data_key_length_check check (char_length(key) between 1 and 128) not valid;
        alter table public.user_data validate constraint user_data_key_length_check;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.user_data'::regclass and conname = 'user_data_value_size_check'
    ) then
        alter table public.user_data
            add constraint user_data_value_size_check check (octet_length(value::text) <= 1048576) not valid;
        alter table public.user_data validate constraint user_data_value_size_check;
    end if;
end $$;

create or replace function public.set_user_data_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = pg_catalog.now();
    return new;
end;
$$;

drop trigger if exists trg_user_data_updated_at on public.user_data;
create trigger trg_user_data_updated_at
    before update on public.user_data
    for each row
    execute function public.set_user_data_updated_at();

alter table public.user_data enable row level security;
alter table public.user_data force row level security;

-- Drop every existing policy (including legacy role "public" policies) inside this transaction
-- before immediately creating the four scoped authenticated policies below.
do $$
declare
    pol record;
begin
    for pol in
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = 'user_data'
    loop
        execute format('drop policy %I on public.user_data', pol.policyname);
    end loop;
end $$;

create policy "Users can read own user_data"
    on public.user_data
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

create policy "Users can insert own user_data"
    on public.user_data
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

create policy "Users can update own user_data"
    on public.user_data
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "Users can delete own user_data"
    on public.user_data
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);

-- Least-privilege table grants: revoke unneeded privileges while keeping anon SELECT
-- (returns 0 rows under RLS so daily keep-alive GET /rest/v1/user_data?select=key&limit=1 returns HTTP 200 []).
revoke all on table public.user_data from anon, authenticated;
grant select on table public.user_data to anon;
grant select, insert, update, delete on table public.user_data to authenticated;

commit;
