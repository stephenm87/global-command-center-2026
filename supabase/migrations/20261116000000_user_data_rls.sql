-- Versioned schema and Row Level Security (RLS) policy for user_data
-- Ensures each authenticated user can only read, write, or delete their own preferences,
-- and idempotently backfills key/value constraints when public.user_data already exists.

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
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.user_data'::regclass and contype = 'p'
    ) then
        alter table public.user_data add primary key (user_id, key);
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
            add constraint user_data_value_size_check check (octet_length(value::text) <= 65536) not valid;
        alter table public.user_data validate constraint user_data_value_size_check;
    end if;
end $$;

create or replace function public.set_user_data_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
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

drop policy if exists "Users can read own user_data" on public.user_data;
create policy "Users can read own user_data"
    on public.user_data
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own user_data" on public.user_data;
create policy "Users can insert own user_data"
    on public.user_data
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own user_data" on public.user_data;
create policy "Users can update own user_data"
    on public.user_data
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own user_data" on public.user_data;
create policy "Users can delete own user_data"
    on public.user_data
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);
