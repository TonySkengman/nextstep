begin;

create table if not exists public.applications (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id uuid not null,
  data jsonb not null,
  version uuid not null default gen_random_uuid(),
  primary key (owner_id, id),
  check (jsonb_typeof(data) = 'object' and (data->>'id') is not distinct from id::text)
);

alter table public.applications enable row level security;
revoke all on public.applications from anon, authenticated;
grant select, insert, update, delete on public.applications to authenticated;

drop policy if exists "Users manage their own applications" on public.applications;
create policy "Users manage their own applications" on public.applications
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

commit;
