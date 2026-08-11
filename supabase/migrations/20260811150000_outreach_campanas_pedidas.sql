-- Pedir una campaña desde el Hub.
--
-- Hasta ahora una campaña nacía ya con sus leads dentro: la creaba el importador
-- desde local. Eso obligaba a que quien decide qué prospectar fuera la misma persona
-- que sabe ejecutar la skill, y dejaba a Juanma y a Gonzalo fuera.
--
-- Con esto la campaña nace vacía y en estado 'pedida': cualquiera rellena sector,
-- zona y oferta desde el móvil, y el trabajo queda encolado. En local se recogen los
-- pedidos, se genera la tanda y el importador la pasa a 'abierta'.
--
-- El Hub NO puede ejecutar la skill: es un sitio estático y no alcanza el portátil.
-- La conexión solo va en un sentido, así que el pedido se deja en la mesa y es local
-- quien lo recoge. Esa es toda la razón de que exista este estado.

alter table public.outreach_campaigns drop constraint if exists outreach_campaigns_status_check;
alter table public.outreach_campaigns add constraint outreach_campaigns_status_check check (
  status in ('pedida', 'abierta', 'enviando', 'cerrada')
);

-- Cuántos leads se piden. Es una petición, no una garantía: la puerta de calidad
-- descarta lo que no llega, y bajar de 20 a 6 sólidos es el comportamiento correcto.
alter table public.outreach_campaigns
  add column if not exists cantidad integer not null default 15
    check (cantidad between 1 and 50);

-- Lo que quien pide sabe y la skill no puede deducir: "los del centro no, ya les
-- escribimos", "prioriza los que no tengan web".
alter table public.outreach_campaigns
  add column if not exists notas text not null default '';

comment on column public.outreach_campaigns.status is
  'pedida = encolada desde el Hub, sin leads todavia. abierta = ya tiene leads que revisar. enviando / cerrada = el resto del ciclo.';

-- La cola de pedidos se lee entera y es corta; el índice existe para que el pulso de
-- la portada no haga un scan por cada carga.
create index if not exists outreach_campaigns_pendientes_idx
  on public.outreach_campaigns (workspace_id, status, created_at);
