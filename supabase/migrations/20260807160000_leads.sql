-- Bandeja inversa de prospección.
--
-- Los leads NO van en hub_states.payload: ese blob se reescribe entero en cada
-- guardado del hub, y un lead lleva huella, porqué y correo redactado. Tabla propia.
--
-- Los leads entran SOLO desde el script local de subida, que usa la service_role.
-- Por eso no hay política de insert para `authenticated`: nada puede aparecer en la
-- bandeja sin haber pasado por la puerta de la skill.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,

  -- ── Identificación (hechos duros, nada inferido) ──
  nombre text not null,
  vertical text not null check (vertical in ('clinica_dental', 'barberia', 'restaurante', 'otro')),
  ciudad text not null,
  -- Sin email no hay correo que aprobar. Es parte de la puerta, por eso not null.
  email text not null,
  web text,
  maps_url text,
  telefono text,
  instagram text,

  -- ── El material que sostiene la decisión ──
  -- Valida contra skills/studio32-lead-prospector/references/huella.schema.json
  huella jsonb not null,
  -- Lo que Juanma lee primero: por qué este negocio y por qué ahora.
  porque text not null,

  -- ── El correo, ya redactado para un remitente concreto ──
  sender_id text not null check (sender_id in ('juanma', 'pancho', 'gonzalo')),
  asunto text not null,
  cuerpo text not null,

  -- ── Scoring (ver references/scoring-rubric.md) ──
  digital_score int check (digital_score between 0 and 100),
  opportunity_score int check (opportunity_score between 0 and 100),
  scores_desglose jsonb,

  -- ── Flujo ──
  -- baja: pidió no ser contactado. Se conserva la fila justo para no volver a escribirle.
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobado', 'rechazado', 'enviado', 'fallido', 'baja')),
  decidido_por uuid references auth.users(id),
  decidido_el timestamptz,
  motivo_rechazo text,
  enviado_el timestamptz,
  error_envio text,

  -- Agrupa una subida para poder revisarla o revertirla entera.
  tanda text,
  created_at timestamptz not null default now()
);

-- Nunca escribir dos veces a la misma dirección, ni por error ni por una tanda
-- repetida. Un lead rechazado o dado de baja sigue ocupando su email: es
-- precisamente lo que impide que vuelva a aparecer.
create unique index if not exists leads_email_unico
  on public.leads (workspace_id, lower(email));

-- La consulta de la bandeja: pendientes primero, más recientes arriba.
create index if not exists leads_bandeja
  on public.leads (workspace_id, estado, created_at desc);

-- Sella quién decidió y cuándo, y vigila que el estado solo avance por donde debe.
--
-- Distingue dos actores por `auth.uid()`:
--   - No nulo  -> una persona decidiendo desde el hub.
--   - Nulo     -> el script local (service_role), que es quien envía.
--
-- Esto importa por dos motivos. Uno: el script no debe pisar `decidido_por` al
-- marcar 'enviado', o se perdería quién aprobó. Dos: el hub no puede marcar nada
-- como enviado — solo lo marca quien realmente envió. Así un fallo en la interfaz
-- no puede saltarse un envío dándolo por hecho.
create or replace function public.guard_lead_transition()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  if actor is not null then
    if not (
      (old.estado = 'pendiente' and new.estado in ('aprobado', 'rechazado', 'baja'))
      or (old.estado = 'aprobado' and new.estado in ('pendiente', 'rechazado', 'baja'))
      or (old.estado = 'rechazado' and new.estado in ('pendiente', 'baja'))
      or (old.estado in ('enviado', 'fallido') and new.estado = 'baja')
    ) then
      raise exception 'Transicion no permitida desde el hub: % -> %', old.estado, new.estado;
    end if;

    new.decidido_por = actor;
    new.decidido_el = now();
  end if;

  return new;
end;
$$;

drop trigger if exists set_lead_decision on public.leads;
drop trigger if exists guard_lead_state on public.leads;
create trigger guard_lead_state
before update on public.leads
for each row execute function public.guard_lead_transition();

alter table public.leads enable row level security;

drop policy if exists "Members can read leads" on public.leads;
create policy "Members can read leads"
on public.leads for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members can decide on leads" on public.leads;
create policy "Members can decide on leads"
on public.leads for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

-- Permisos por columna, y esto es deliberado:
--
--   Se puede editar el correo (asunto, cuerpo, remitente) y decidir sobre el lead.
--   NO se puede tocar `huella`, `porque` ni los scores desde el hub.
--
-- La evidencia es inmutable: es lo que justifica que el correo se enviara, y tiene
-- que seguir siendo auditable después. Si la evidencia está mal, se corrige en la
-- skill y se vuelve a subir, no se maquilla en la bandeja.
grant select on public.leads to authenticated;
grant update (estado, motivo_rechazo, asunto, cuerpo, sender_id) on public.leads to authenticated;

-- La bandeja se actualiza sola cuando otro miembro decide, igual que hub_states.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'leads'
  ) then
    alter publication supabase_realtime add table public.leads;
  end if;
end $$;
