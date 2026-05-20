-- Fishing spots: user-saved locations for future reference.
-- Architecture supports private/friends/public visibility for future premium tiers.

begin;

create table if not exists public.fishing_spots (
  id          uuid            primary key default gen_random_uuid(),
  user_id     uuid            not null references public.profiles(id) on delete cascade,
  name        text            not null,
  notes       text,
  latitude    numeric(10, 7)  not null,
  longitude   numeric(10, 7)  not null,
  visibility  text            not null default 'private'
                              check (visibility in ('private', 'friends', 'public')),
  created_at  timestamptz     not null default now(),
  updated_at  timestamptz     not null default now()
);

alter table public.fishing_spots enable row level security;

-- Owners see their own; friends-visibility respects accepted friendships; public is open.
drop policy if exists "fishing_spots_select" on public.fishing_spots;
create policy "fishing_spots_select"
  on public.fishing_spots
  for select
  using (
    user_id = auth.uid()
    or visibility = 'public'
    or (
      visibility = 'friends'
      and exists (
        select 1
        from public.friendships f
        where f.status = 'accepted'
          and (
            (f.requester_id = auth.uid() and f.receiver_id = fishing_spots.user_id)
            or
            (f.receiver_id  = auth.uid() and f.requester_id = fishing_spots.user_id)
          )
      )
    )
  );

drop policy if exists "fishing_spots_insert" on public.fishing_spots;
create policy "fishing_spots_insert"
  on public.fishing_spots
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "fishing_spots_update" on public.fishing_spots;
create policy "fishing_spots_update"
  on public.fishing_spots
  for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "fishing_spots_delete" on public.fishing_spots;
create policy "fishing_spots_delete"
  on public.fishing_spots
  for delete
  using (auth.uid() = user_id);

commit;
