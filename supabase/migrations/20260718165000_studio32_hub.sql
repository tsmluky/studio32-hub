create table if not exists public.workspaces (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.workspaces (id, name)
values ('studio32', 'Studio32')
on conflict (id) do update set name = excluded.name;

create table if not exists public.workspace_members (
  workspace_id text not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_id text not null check (member_id in ('juanma', 'pancho', 'gonzalo')),
  email text not null,
  name text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  unique (workspace_id, member_id),
  unique (workspace_id, email)
);

create or replace function public.is_workspace_member(requested_workspace_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = requested_workspace_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_workspace_member(text) from public;
grant execute on function public.is_workspace_member(text) to authenticated;

create table if not exists public.hub_states (
  workspace_id text primary key references public.workspaces(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create or replace function public.touch_hub_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.revision = old.revision + 1;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists set_hub_state_audit on public.hub_states;
create trigger set_hub_state_audit
before update on public.hub_states
for each row execute function public.touch_hub_state();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.hub_states enable row level security;

drop policy if exists "Members can read their workspace" on public.workspaces;
create policy "Members can read their workspace"
on public.workspaces for select to authenticated
using (public.is_workspace_member(id));

drop policy if exists "Members can read their membership" on public.workspace_members;
create policy "Members can read their membership"
on public.workspace_members for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Members can read hub state" on public.hub_states;
create policy "Members can read hub state"
on public.hub_states for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members can create hub state" on public.hub_states;
create policy "Members can create hub state"
on public.hub_states for insert to authenticated
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members can update hub state" on public.hub_states;
create policy "Members can update hub state"
on public.hub_states for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

grant select on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
grant select, insert, update on public.hub_states to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'hub_states'
  ) then
    alter publication supabase_realtime add table public.hub_states;
  end if;
end $$;
