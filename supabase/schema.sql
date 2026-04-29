-- Run once in the Supabase SQL editor for project mantrabesupabase.
-- Source of truth for the cloud-sync schema. Local app state is the
-- primary store; this table just mirrors mantras for signed-in users so
-- they can hop between devices.

create table if not exists public.mantras (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'mantra' check (kind in ('mantra', 'reminder')),
  text text not null,
  frequency_minutes int not null,
  active_hours_start int not null check (active_hours_start between 0 and 24),
  active_hours_end int not null check (active_hours_end between 0 and 24),
  active_days bool[] not null,
  enabled bool not null default true,
  sound_id text not null default 'clear_bell',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mantras_user_id_idx on public.mantras (user_id);

alter table public.mantras enable row level security;

-- A user can only see and modify their own rows.
drop policy if exists "mantras: select own" on public.mantras;
create policy "mantras: select own" on public.mantras
  for select using (auth.uid() = user_id);

drop policy if exists "mantras: insert own" on public.mantras;
create policy "mantras: insert own" on public.mantras
  for insert with check (auth.uid() = user_id);

drop policy if exists "mantras: update own" on public.mantras;
create policy "mantras: update own" on public.mantras
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "mantras: delete own" on public.mantras;
create policy "mantras: delete own" on public.mantras
  for delete using (auth.uid() = user_id);
