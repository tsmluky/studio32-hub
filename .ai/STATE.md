# Estado — studio32-hub

> Se **sobrescribe**, no se acumula. Tope ~100 líneas. Última actualización: 2026-08-11.

## Qué es

Workspace interno del equipo (Juanma, Pancho, Gonzalo). Vive en `hub.studio32.es`.
El build estático se publica desde el repo gemelo `studio32-hub-live` — **generado, no
se edita a mano**.

## Dónde está ahora

- Vistas: Hoy, Tareas, Calendario, Proyectos, Inbox, Biblioteca y **Herramientas**.
- Tablas: `workspaces`, `workspace_members`, `hub_states` y `outreach_*` (4).
- Repo hermano `studio32-hub-agent` (bot de Telegram, en Railway).

## Aviso: esto se construyó tres veces

Hubo dos implementaciones paralelas de la prospección, hechas en máquinas distintas sin
saber la una de la otra: `feat/prospeccion-email` (sobremesa, 04/08, esquema
`outreach_*` ya aplicado en producción) y la tabla `leads` de `main` (portátil, 07/08,
nunca aplicada). El 11/08 se fusionaron: **gana `outreach_*`**.

**Antes de tocar prospección, mira si ya existe.** El coste de no hacerlo ya son tres
intentos. `git branch -r` y una consulta al esquema de Supabase cuestan un minuto.

## Herramientas · Prospección — el ciclo

1. **Hub** — Herramientas › Prospección › "Pedir campaña": sector, zona, oferta,
   cantidad y notas. Nace en estado `pedida`, sin leads.
2. **Local** — `npm run outreach:pendientes` lista los encargos y escupe el prompt
   listo para pegar en Claude Code. Corre con la **suscripción**, no por API: es la
   razón de que este paso sea local y no un worker en la nube.
3. **Local** — `npm run outreach:import -- tanda.json` sube leads y borradores; la
   campaña pasa a `abierta`.
4. **Hub** — se revisa el correo con su evidencia y se aprueba.
5. **Edge Function `outreach-send`** — envía por SMTP de Hostinger.

## Lo que hay que saber antes de tocarlo

- **Una sola cuenta de correo.** `info@studio32.es` en Hostinger, con alias
  `juanma@`, `gonzalo@` y `francisco@`. El SMTP se autentica como la cuenta real y
  pone el alias en `From:`.
- **Pancho es `francisco@`.** Su id interno es `pancho` (login del Hub,
  `owner_member_id`), su correo es `francisco@studio32.es`. El cruce vive solo en
  `src/remitentes.json`.
- **Railway no sirve para enviar.** El plan Hobby bloquea SMTP saliente (25/465/587);
  se abre a partir de Pro. Por eso el envío vive en una Edge Function.
- **Solo la Edge Function marca 'enviado'.** Las políticas se lo prohíben al cliente,
  para que un fallo de interfaz no dé por enviado algo que no salió.
- **Tres fronteras en el envío:** aprobación humana explícita, lista de bajas, y no
  escribir dos veces a la misma dirección en 60 días.
- **La huella es esquema compartido con `studio32-agent`.** Si un lead convierte,
  alimenta `templates/<vertical>/`.

## Qué falta para operarlo

| | Estado |
|---|---|
| Tablas `outreach_*` | aplicadas, incluida la de campañas pedidas |
| Vista en el Hub + pedir campaña | hecho |
| `outreach:pendientes` | hecho, **sin probar contra la base** |
| Importador | de la rama, **sin repasar** |
| `outreach-send` con SMTP | reescrita, **sin desplegar y sin probar** |
| Secretos SMTP en Supabase | **pendientes** |

> **Acción pendiente de una persona:** poner los secretos SMTP en Supabase → Edge
> Functions → Secrets (ver `docs/PROSPECCION.md`), desplegar la función, y hacer la
> prueba a una dirección propia antes de escribir a nadie real.

**Riesgo abierto sin resolver:** nadie ha comprobado todavía que el SMTP de Hostinger
acepte enviar con `From:` un alias autenticándose como `info@`. En el webmail funciona;
por SMTP es lo normal, pero no está verificado. Si fallara, la salida es enviar todo
desde `info@` y poner el nombre del socio en el `From:` visible.

**Segundo riesgo:** que Deno Deploy no deje salir el 465. Hay indicios de que sí, pero
no está probado. Si fallara: Railway Pro (~20€/mes) o volver a un script local.

## Riesgo abierto

`src/App.tsx` está en ~3.100 líneas. Prospección ya vive fuera
(`OutreachView.tsx`, `CampaignRequest.tsx`, `outreach.ts`, `ui.tsx`, `types.ts`).

## Bloqueadores

El de contexto: la congelación de scope (cero features nuevas hasta que gh-dent esté
vivo en producción) sigue vigente y esto la roza. Se avanza por ser captación, no
producto, pero el reloj del primer cliente sigue parado.

## Al terminar cualquier tarea aquí

`git pull --rebase` al empezar, y commit + push de `.ai/` al cerrar. Y **antes de
empezar, `git branch -r`**: este repo se trabaja desde dos máquinas y ya ha costado
caro no mirarlo.
