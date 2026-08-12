# Convenciones — studio32-hub

Específico de este repo. No replicar a ciegas en otros.

## Stack

- React 19 + TypeScript, servido con **vinext** sobre Vite 8.
- Supabase para auth y persistencia (`@supabase/supabase-js`).
- Iconos: `lucide-react`. Estilos: un único `src/style.css`, sin framework CSS.
- Sin librería de estado: todo pasa por `HubState` en `src/App.tsx`.

## Comandos

```bash
npm run dev              # desarrollo
npm run dev:lan          # desarrollo accesible desde el móvil en la misma red
npm run build            # build de la app
npm run build:static     # build estático -> static-dist/ (lo que se publica)
npm run supabase:bootstrap   # crea tablas y miembros. Necesita SERVICE_ROLE_KEY
npm run supabase:reset-state # limpia el estado del hub
npm run supabase:migrate     # aplica supabase/migrations/. Necesita SUPABASE_DB_URL

npm run outreach         # que campanas hay pedidas desde el Hub
npm run outreach -- tanda.json   # sube una tanda. ESCRIBE al lanzarlo
npm run outreach:probar -- --para x@y.z # siembra un lead de prueba
npm run fn:deploy                   # despliega la Edge Function de envio
```

**`npm run outreach -- <archivo>` no tiene modo de revisión: escribe en cuanto se lanza.** Lo que
sube entra como borrador y nada sale sin que alguien lo apruebe en el Hub, pero el JSON
hay que repasarlo antes, no después.

`fn:deploy` lleva `--use-api` porque el empaquetado local falla en el portátil.

## Arquitectura del estado

`hub_states` guarda **una fila por workspace** con todo el estado en un `jsonb`
(`payload`), más `revision` y auditoría por trigger. Cada guardado reescribe el blob
entero.

Consecuencia práctica, y es la regla más importante de este repo:

> **Lo que crece sin techo no va en `payload`.** Tareas, notas y proyectos sí: son
> pocos y pequeños. Leads con correos redactados, adjuntos o historiales, no —
> van en su propia tabla.

Tabla nueva = migración en `supabase/migrations/` + RLS con `is_workspace_member()`
+ `grant` explícito a `authenticated`. Nunca dejar una tabla sin RLS: la clave anon
está en el cliente.

## Móvil primero

El hub se usa desde el móvil más que desde el escritorio. Cualquier vista nueva se
diseña y se prueba primero a 375px de ancho. Si solo funciona bien en escritorio,
no está terminada.

## Modularidad

`src/App.tsx` acumula demasiado (~3.000 líneas). **No añadir vistas nuevas dentro.**
Cada vista nueva va a su propio archivo en `src/` y se importa. Lo existente se
extrae cuando se toque, no en una refactorización aparte.

Las piezas de presentación compartidas viven en `src/ui.tsx` (`PageHeading`,
`EmptyState`). Importarlas desde ahí, no desde `App.tsx`: `App.tsx` importa las
vistas, así que una vista que le importe algo a él crea un ciclo.

Herramienta nueva de la sección Herramientas = una entrada en `tools`
(`src/ToolsView.tsx`) + su vista en archivo propio + su caso en el switch de
`App.tsx`. Nada más.

## Deploy

`studio32-hub-live` es el repo de publicación y contiene **build generado**. No se
edita a mano nunca. `static-dist/` tampoco se toca a mano.

## Secretos

- `.env` está ignorado; `.env.example` documenta las variables sin valores.
- `SUPABASE_SERVICE_ROLE_KEY` solo para scripts locales. Jamás en código de cliente
  ni en nada con prefijo `VITE_` (todo lo `VITE_` acaba en el bundle público).
- Credenciales de envío de correo: solo en `.env` local de quien ejecuta el script.
  Ni en el repo, ni en Supabase, ni en el hub.

## Contexto

- Rutas **siempre relativas**. Nada de `C:\Users\...` ni nombres de máquina: el
  sobremesa y el portátil tienen usuarios distintos y toda ruta absoluta se rompe.
- Otros repos se referencian por nombre + ruta interna, no por ruta de disco.
