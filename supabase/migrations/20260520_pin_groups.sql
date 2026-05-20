-- Pin groups registry table.
-- Stores the canonical set of named catch groups per user.
-- catch_logs.pin_group retains the string name for offline-queue resilience;
-- this table drives autocomplete and prevents duplicates.

begin;

create table if not exists public.pin_groups (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  created_at  timestamptz not null default now(),
  -- One group name per user (application layer normalises case before insert)
  unique (user_id, name)
);

alter table public.pin_groups enable row level security;

drop policy if exists "pin_groups_select" on public.pin_groups;
create policy "pin_groups_select" on public.pin_groups
  for select using (auth.uid() = user_id);

drop policy if exists "pin_groups_insert" on public.pin_groups;
create policy "pin_groups_insert" on public.pin_groups
  for insert with check (auth.uid() = user_id);

drop policy if exists "pin_groups_update" on public.pin_groups;
create policy "pin_groups_update" on public.pin_groups
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "pin_groups_delete" on public.pin_groups;
create policy "pin_groups_delete" on public.pin_groups
  for delete using (auth.uid() = user_id);

create index if not exists idx_pin_groups_user_id on public.pin_groups (user_id);

commit;
