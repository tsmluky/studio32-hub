-- Cierra el ciclo de la bandeja de prospección: deduplicar por negocio (no solo por
-- dirección) y poder marcar qué pasó después de enviar.
--
-- Las dos cosas existen por el mismo motivo: no ser molestos. El índice único por
-- email impedía escribir dos veces a la misma dirección, pero no impedía escribir a
-- `info@clinica.es` y a `citas@clinica.es` — dos correos al mismo negocio, que es
-- exactamente lo que hace que a uno lo marquen como spam.

-- ── 1. Dedupe por negocio ──
--
-- El dominio lo calcula el script de subida, no la base de datos: solo cuenta cuando
-- es un dominio propio. Dos negocios distintos pueden usar los dos `gmail.com`, así
-- que ahí el dominio no identifica nada y se deja a null — esas filas caen de vuelta
-- al índice por email, que sigue vigente.
alter table public.leads add column if not exists dominio text;

comment on column public.leads.dominio is
  'Dominio propio del negocio (nunca gmail/hotmail/etc). Lo rellena scripts/subir-tanda.mjs. Null = el negocio no tiene dominio propio y solo se deduplica por email.';

create unique index if not exists leads_dominio_unico
  on public.leads (workspace_id, dominio)
  where dominio is not null;

-- ── 2. Qué pasó después de enviar ──
--
-- Sin esto la bandeja se queda en 'enviado' para siempre y no hay forma de saber a
-- quién ya se le hizo caso. `respondido` y `no_interesa` son cierres normales;
-- `baja` sigue siendo el que además bloquea volver a escribir.
alter table public.leads drop constraint if exists leads_estado_check;
alter table public.leads drop constraint if exists leads_estado_valido;
alter table public.leads add constraint leads_estado_valido check (
  estado in ('pendiente', 'aprobado', 'rechazado', 'enviado', 'fallido', 'baja', 'respondido', 'no_interesa')
);

-- Se reescribe entera (no se parchea) para que el conjunto de transiciones válidas
-- se lea de un vistazo en un solo sitio.
--
-- Sigue distinguiendo dos actores por `auth.uid()`:
--   - No nulo  -> una persona decidiendo desde el hub.
--   - Nulo     -> el script local (service_role), que es quien envía.
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
      -- Cerrar el ciclo a mano tras el envío: contestaron, o no les interesa.
      or (old.estado = 'enviado' and new.estado in ('respondido', 'no_interesa', 'baja'))
      -- Un envío fallido (buzón lleno, dirección muerta) se puede reintentar
      -- devolviéndolo a la cola. Sigue sin poder marcarse 'enviado' desde el hub.
      or (old.estado = 'fallido' and new.estado in ('aprobado', 'baja'))
      or (old.estado in ('respondido', 'no_interesa') and new.estado = 'baja')
    ) then
      raise exception 'Transicion no permitida desde el hub: % -> %', old.estado, new.estado;
    end if;

    new.decidido_por = actor;
    new.decidido_el = now();
  end if;

  return new;
end;
$$;

drop trigger if exists guard_lead_state on public.leads;
create trigger guard_lead_state
before update on public.leads
for each row execute function public.guard_lead_transition();
