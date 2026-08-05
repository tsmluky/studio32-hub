-- Prospección y envío de correo de Studio32.
--
-- Los leads y los envíos no viven en hub_states.payload a propósito: ese documento
-- se reescribe entero en cada cambio y Realtime lo reenvía completo a los tres
-- dispositivos. Una lista de prospección crece sin techo y el registro de envíos es
-- append-only, así que necesitan tablas propias con índices y escritura granular.
--
-- Las políticas replican el modelo ya existente: solo miembros del workspace de
-- Studio32, comprobado con public.is_workspace_member.

create type public.outreach_status as enum (
  'nuevo', 'contactado', 'respondido', 'reunion', 'cliente', 'descartado'
);

create type public.outreach_message_status as enum (
  'borrador', 'aprobado', 'enviando', 'enviado', 'fallido'
);

-- ---------------------------------------------------------------------------
-- Campañas
--
-- El trabajo se sirve por tandas: "esta semana, clínicas de Getafe". La campaña
-- es lo que hace que Juanma tenga una cola acotada que terminar en vez de una
-- lista infinita, y lo que luego permite comparar qué sector y qué zona
-- convierten. La oferta vive aquí porque condiciona el scoring y la redacción.
-- ---------------------------------------------------------------------------

create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,

  name text not null,
  sector text not null default '',
  city text not null default '',
  oferta text not null default '',

  status text not null default 'abierta'
    check (status in ('abierta', 'enviando', 'cerrada')),

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists outreach_campaigns_workspace_idx
  on public.outreach_campaigns (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------

create table if not exists public.outreach_leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  campaign_id uuid references public.outreach_campaigns(id) on delete set null,

  business_name text not null,
  sector text not null default '',
  city text not null default '',
  address text not null default '',
  postal_code text not null default '',

  website text not null default '',
  email text not null default '',
  phone text not null default '',
  mobile text not null default '',
  maps_url text not null default '',

  -- Diagnóstico de la auditoría de presencia digital.
  score integer not null default 0 check (score between 0 and 100),
  digital_level text not null default 'medio' check (digital_level in ('bajo', 'medio', 'alto')),
  has_whatsapp boolean not null default false,
  has_online_booking boolean not null default false,
  rating numeric(2,1),
  reviews integer,
  problems jsonb not null default '[]'::jsonb,

  status public.outreach_status not null default 'nuevo',
  owner_member_id text check (owner_member_id in ('juanma', 'pancho', 'gonzalo')),
  notes text not null default '',
  source text not null default 'manual',

  -- La huella: qué vende, cómo habla, qué dicen sus clientes y el detalle ancla,
  -- cada dato con su fuente. Es lo que permite que el Hub cuente la historia del
  -- lead en vez de enseñar una fila de tabla, y lo que hace que el correo se
  -- pueda defender por teléfono. Documento por lead, escritura granular.
  huella jsonb not null default '{}'::jsonb,
  huella_generated_at timestamptz,

  -- Enlace de baja: va en cada correo y es lo que rellena outreach_suppressions.
  unsubscribe_token uuid not null default gen_random_uuid(),

  -- Duplicado detectado pero no bloqueado. Lo decide una persona desde el Hub.
  duplicate_of uuid references public.outreach_leads(id) on delete set null,

  -- Identidad normalizada. Se calcula sola para que no dependa de que quien
  -- importa se acuerde de limpiar los datos.
  domain text generated always as (
    nullif(split_part(regexp_replace(lower(website), '^https?://(www\.)?', ''), '/', 1), '')
  ) stored,
  phone_digits text generated always as (
    nullif(regexp_replace(phone, '\D', '', 'g'), '')
  ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

-- Identidad dura: el dominio. Dos filas con el mismo dominio son el mismo
-- negocio, sin discusión. Normalizado, así que "http://www.x.com/" y
-- "https://x.com" colisionan como deben.
create unique index if not exists outreach_leads_workspace_domain_key
  on public.outreach_leads (workspace_id, domain)
  where domain is not null;

-- Identidad blanda: teléfono, correo y nombre+CP. NO son únicos a propósito.
-- Un negocio sin web es justo el lead más valioso, y dos negocios pueden
-- compartir teléfono o gestoría. Un índice único aquí tiraría leads buenos en
-- silencio; estos índices existen para DETECTAR el duplicado y marcarlo en
-- duplicate_of, no para impedirlo.
create index if not exists outreach_leads_workspace_phone_idx
  on public.outreach_leads (workspace_id, phone_digits)
  where phone_digits is not null;

create index if not exists outreach_leads_workspace_email_idx
  on public.outreach_leads (workspace_id, lower(email))
  where email <> '';

create index if not exists outreach_leads_workspace_name_idx
  on public.outreach_leads (workspace_id, lower(business_name), postal_code);

create index if not exists outreach_leads_campaign_idx
  on public.outreach_leads (campaign_id, score desc);

create index if not exists outreach_leads_workspace_score_idx
  on public.outreach_leads (workspace_id, score desc);

create index if not exists outreach_leads_workspace_status_idx
  on public.outreach_leads (workspace_id, status);

-- ---------------------------------------------------------------------------
-- Mensajes
-- ---------------------------------------------------------------------------

create table if not exists public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.outreach_leads(id) on delete cascade,

  -- El remitente es un alias del dominio propio. Las respuestas no vuelven por
  -- API: caen en el buzón real de Hostinger, que es donde se sigue el hilo.
  from_email text not null default '',
  reply_to text not null default '',

  to_email text not null,
  to_name text not null default '',
  subject text not null,
  body text not null,

  status public.outreach_message_status not null default 'borrador',

  -- De dónde sale cada afirmación de ESTE correo: la frase, la cita literal que
  -- la sostiene y su fuente. Sin esto, quien revisa tiene que fiarse; con esto
  -- puede comprobarlo en dos segundos y defenderlo si el prospecto pregunta.
  -- Un correo con afirmaciones sin evidencia no debería llegar a 'aprobado'.
  evidencia jsonb not null default '[]'::jsonb,

  -- Rastro del proveedor de envío. Se envía por la API HTTPS de Resend porque
  -- Railway bloquea el SMTP saliente y el dominio ya está verificado ahí.
  provider text not null default 'resend',
  provider_message_id text,
  error text not null default '',

  -- Quién dio el visto bueno. Ningún mensaje sale sin este campo relleno.
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists outreach_messages_lead_idx
  on public.outreach_messages (lead_id, created_at desc);

create index if not exists outreach_messages_workspace_status_idx
  on public.outreach_messages (workspace_id, status);

-- La frontera que de verdad importa no es "no repetir el lead", es "no volver a
-- escribir a la misma persona". Dos leads distintos pueden compartir correo (una
-- gestoría, una cadena), así que la comprobación de "¿ya le escribimos?" se hace
-- por dirección y no por lead. Este índice la hace barata antes de cada envío.
create index if not exists outreach_messages_workspace_to_email_idx
  on public.outreach_messages (workspace_id, lower(to_email), sent_at desc);

-- ---------------------------------------------------------------------------
-- Bajas
--
-- Frontera dura: si un correo está aquí, la Edge Function se niega a enviar.
-- Se rellena desde el enlace de baja de cada mensaje y a mano desde el Hub.
-- ---------------------------------------------------------------------------

create table if not exists public.outreach_suppressions (
  workspace_id text not null references public.workspaces(id) on delete cascade,
  email text not null,
  reason text not null default 'baja solicitada',
  created_at timestamptz not null default now(),
  primary key (workspace_id, email)
);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.touch_outreach_row()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_outreach_leads_updated_at on public.outreach_leads;
create trigger set_outreach_leads_updated_at
before update on public.outreach_leads
for each row execute function public.touch_outreach_row();

drop trigger if exists set_outreach_messages_updated_at on public.outreach_messages;
create trigger set_outreach_messages_updated_at
before update on public.outreach_messages
for each row execute function public.touch_outreach_row();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.outreach_campaigns enable row level security;
alter table public.outreach_leads enable row level security;
alter table public.outreach_messages enable row level security;
alter table public.outreach_suppressions enable row level security;

drop policy if exists "Members read campaigns" on public.outreach_campaigns;
create policy "Members read campaigns"
on public.outreach_campaigns for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members write campaigns" on public.outreach_campaigns;
create policy "Members write campaigns"
on public.outreach_campaigns for insert to authenticated
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members update campaigns" on public.outreach_campaigns;
create policy "Members update campaigns"
on public.outreach_campaigns for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members delete campaigns" on public.outreach_campaigns;
create policy "Members delete campaigns"
on public.outreach_campaigns for delete to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read leads" on public.outreach_leads;
create policy "Members read leads"
on public.outreach_leads for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members write leads" on public.outreach_leads;
create policy "Members write leads"
on public.outreach_leads for insert to authenticated
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members update leads" on public.outreach_leads;
create policy "Members update leads"
on public.outreach_leads for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members delete leads" on public.outreach_leads;
create policy "Members delete leads"
on public.outreach_leads for delete to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read messages" on public.outreach_messages;
create policy "Members read messages"
on public.outreach_messages for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members write messages" on public.outreach_messages;
create policy "Members write messages"
on public.outreach_messages for insert to authenticated
with check (public.is_workspace_member(workspace_id));

-- El cliente puede editar y aprobar borradores, pero no puede marcar nada como
-- enviado: esa transición la hace la Edge Function con la clave de servicio.
drop policy if exists "Members update drafts" on public.outreach_messages;
create policy "Members update drafts"
on public.outreach_messages for update to authenticated
using (public.is_workspace_member(workspace_id) and status in ('borrador', 'aprobado', 'fallido'))
with check (public.is_workspace_member(workspace_id) and status in ('borrador', 'aprobado'));

drop policy if exists "Members delete drafts" on public.outreach_messages;
create policy "Members delete drafts"
on public.outreach_messages for delete to authenticated
using (public.is_workspace_member(workspace_id) and status in ('borrador', 'aprobado', 'fallido'));

drop policy if exists "Members read suppressions" on public.outreach_suppressions;
create policy "Members read suppressions"
on public.outreach_suppressions for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members write suppressions" on public.outreach_suppressions;
create policy "Members write suppressions"
on public.outreach_suppressions for insert to authenticated
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members delete suppressions" on public.outreach_suppressions;
create policy "Members delete suppressions"
on public.outreach_suppressions for delete to authenticated
using (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.outreach_campaigns to authenticated;
grant select, insert, update, delete on public.outreach_leads to authenticated;
grant select, insert, update, delete on public.outreach_messages to authenticated;
grant select, insert, delete on public.outreach_suppressions to authenticated;

-- Realtime: los tres ven el mismo tablero de prospección sin recargar.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'outreach_leads'
  ) then
    alter publication supabase_realtime add table public.outreach_leads;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'outreach_messages'
  ) then
    alter publication supabase_realtime add table public.outreach_messages;
  end if;
end $$;
