-- Envío programado de lo aprobado (14/09/2026).
--
-- Aprobar pasa a ser programar: quien revisa aprueba cuando le viene bien y los
-- correos salen solos, repartidos en horario laboral y sin pasar del cupo diario que
-- ya aplica `outreach-send`. La aprobación sigue siendo de una persona; lo único que se
-- automatiza es pulsar "Enviar".
--
-- Tres piezas:
--   1. `outreach_settings`: el interruptor. Nace APAGADO; se enciende desde el Hub.
--   2. pg_cron + pg_net: cada 10 minutos en franja laboral llaman a la función.
--   3. La función decide si toca enviar (interruptor, día, hora, ritmo, cupo). El
--      cron solo llama; así las reglas viven en un único sitio.
--
-- El secreto con el que el cron se identifica ante la función NO está aquí: el repo
-- es público. Vive en Vault con el nombre `outreach_cron_secret` y, con el mismo valor,
-- en el secreto `OUTREACH_CRON_SECRET` de la función. Se ponen a mano, una vez. Junto
-- a él, `outreach_anon_key` (la clave anon del proyecto, que es pública pero no hace
-- falta repetirla en el repo).
-- Idempotente, como el resto de migraciones del repo.

create table if not exists public.outreach_settings (
  workspace_id text primary key references public.workspaces(id) on delete cascade,
  envio_automatico boolean not null default false,
  -- Si el envío automático se paró solo (un fallo de SMTP), aquí queda el porqué, para
  -- que quien lo vuelva a encender sepa qué pasó antes de hacerlo.
  pausa_motivo text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.outreach_settings (workspace_id)
values ('studio32')
on conflict (workspace_id) do nothing;

drop trigger if exists set_outreach_settings_updated_at on public.outreach_settings;
create trigger set_outreach_settings_updated_at
before update on public.outreach_settings
for each row execute function public.touch_outreach_row();

alter table public.outreach_settings enable row level security;

drop policy if exists "Members read outreach settings" on public.outreach_settings;
create policy "Members read outreach settings"
on public.outreach_settings for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members update outreach settings" on public.outreach_settings;
create policy "Members update outreach settings"
on public.outreach_settings for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

grant select, update on public.outreach_settings to authenticated;

-- ---------------------------------------------------------------------------
-- El reloj
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- De 07 a 18 UTC, lunes a viernes: cubre 9:00-20:00 de Madrid en verano y 8:00-19:00
-- en invierno. La franja exacta (9:30-19:00 de Madrid) la recorta la función, que sí
-- sabe de husos horarios; el cron solo evita llamadas inútiles de madrugada.
select cron.unschedule('outreach-envio-programado')
where exists (select 1 from cron.job where jobname = 'outreach-envio-programado');

select cron.schedule(
  'outreach-envio-programado',
  '*/10 7-18 * * 1-5',
  $$
  select net.http_post(
    url := 'https://wwhinwxedcvpxprmcsta.supabase.co/functions/v1/outreach-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- La pasarela de funciones exige un JWT antes de dejar pasar la petición. La
      -- clave anon basta para eso; quien autoriza el envío es el secreto de debajo.
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'outreach_anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'outreach_cron_secret')
    ),
    body := '{"programado": true}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
