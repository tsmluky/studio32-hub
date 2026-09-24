-- Aprobación automática con margen (24/09/2026).
--
-- Un borrador que pasa la revisión automática (supabase/functions/_shared/reglas-correo.js)
-- y lleva `margen_aprobacion_horas` sin tocarse se aprueba solo, firmado por quien diga
-- `firma_miembro`. La hace `outreach-send` en cada pasada del reloj; esta migración solo
-- añade el interruptor, el margen, la firma y la marca que distingue lo aprobado así.
--
-- El margen cuenta desde `updated_at` del mensaje, no desde que se creó: si alguien edita
-- el borrador, el plazo vuelve a empezar y el texto nuevo también tiene su ventana para
-- que alguien lo lea.
--
-- Idempotente, como todas las del repo.

alter table public.outreach_settings
  add column if not exists aprobacion_automatica boolean not null default false,
  add column if not exists margen_aprobacion_horas integer not null default 24,
  -- Quien firma lo aprobado solo: se queda el lead y le llegan las respuestas. El `from`
  -- va aparte porque el alias de firma no es el correo de acceso (Pancho entra como
  -- pancho@ y firma como francisco@). Gemelo de src/remitentes.json: si cambia allí,
  -- cámbialo aquí.
  add column if not exists firma_miembro text not null default 'pancho',
  add column if not exists firma_from text not null default 'Francisco · Studio32 <francisco@studio32.es>';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'outreach_settings_margen_aprobacion_check') then
    alter table public.outreach_settings
      add constraint outreach_settings_margen_aprobacion_check check (margen_aprobacion_horas between 1 and 168);
  end if;
end $$;

-- Para saber después qué salió sin que nadie lo aprobara a mano. `approved_by` se rellena
-- igual (con quien firma), porque el envío exige aprobador; esta marca es la que dice que
-- no lo pulsó una persona.
alter table public.outreach_messages
  add column if not exists aprobacion_automatica boolean not null default false;
