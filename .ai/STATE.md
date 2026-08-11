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

## Qué está probado (11/08) y qué no

| | Estado |
|---|---|
| Tablas `outreach_*`, incluida la de campañas pedidas | aplicadas |
| Secretos SMTP en Supabase | puestos |
| `outreach-send` con SMTP de Hostinger | desplegada y **probada con envíos reales** |
| Deno deja salir el 465 | ✅ verificado |
| Hostinger acepta el alias en `From:` | ✅ verificado — llega como `juanma@studio32.es` |
| Las respuestas vuelven al buzón real | ✅ verificado, se respondió y llegó |
| Aprobar → enviar desde el Hub | ✅ verificado end-to-end |
| Baja bloquea el envío | ✅ verificado: se reaprobó a propósito y salió `Enviados 0 de 1` |
| Llega a Recibidos, no a Spam | ✅ un envío. Un dato, no una conclusión |
| `outreach:pendientes` contra la base | ✅ responde |
| Pedir campaña desde el Hub | construido, **el ciclo completo nunca se ha ejecutado** |
| Importador `import-outreach.mjs` | de la rama del sobremesa, **sin repasar** |

**Desplegar la función:** `npm run fn:deploy`. Lleva `--use-api` porque el empaquetado
local falla en este portátil (busca un `output.eszip` que no genera) y además ensucia el
repo con `doc/` y `supabase/.temp/`.

## Agujero conocido: la firma y quién manda

Al fusionar se quedó a medias algo que conviene decidir antes de la primera tanda real:

- **El remitente es por CAMPAÑA, no por quien aprueba.** Lo fija `campaign.from_email`
  en el JSON que importa `scripts/import-outreach.mjs`. El botón "lo envío yo" que se
  diseñó para la tabla `leads` no existe aquí.
- **Nadie compone la firma.** `outreach-send` solo añade el pie de baja. La firma la
  tiene que escribir la skill dentro del cuerpo, y `SKILL.md` ya lo dice así.
- **`src/remitentes.json` es referencia, no código.** Ningún módulo lo importa: quedó
  huérfano al borrarse la ruta de `leads`. Sirve para que la skill sepa qué dirección
  usar al firmar.

Si se quiere el comportamiento "firma quien aprueba", hay que cambiar `outreach-send`
para que componga la firma desde `remitentes.json` según el `from_email` del mensaje, y
dejar de escribirla en el cuerpo. No es mucho, pero no está hecho.

## Lo que sigue sin resolver

- **Nadie lee el buzón.** Si un negocio responde BAJA, esa respuesta llega a Hostinger y
  se queda ahí: una persona tiene que verla y pulsar "No escribir más" en el Hub.
  Automatizarlo pide IMAP, y eso es meter las credenciales del buzón en otro sitio.
- **No hay página de bajas.** El pie del correo pide responder BAJA. La tabla ya tiene
  `unsubscribe_token` por lead, así que una página que reciba el token y escriba la baja
  sola cerraría el ciclo. Es lo más barato que queda por hacer.
- **La interfaz está sin pulir.** Es lo siguiente que se va a tocar.

## Ojo con esto

Hay un correo real preparado para **Clínica Dental Dr. Garcés** (`cdentaldrgarces@gmail.com`)
desde los datos semilla del 04/08. Estuvo marcado como `aprobado` sin que nadie lo hubiera
revisado, y una tanda de envío lo habría mandado. Se devolvió a `borrador` el 11/08.

**Antes de pulsar Enviar, mirar siempre qué hay en la cola de aprobados.** El diálogo de
confirmación lista los destinatarios: leerlo, no darle a aceptar.

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
