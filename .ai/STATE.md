# Estado — studio32-hub

> Se **sobrescribe**, no se acumula. Tope ~100 líneas. Última actualización: 2026-08-13.

## Qué es

Workspace interno del equipo (Juanma, Pancho, Gonzalo). Vive en `hub.studio32.es`.
El build estático se publica desde el repo gemelo `studio32-hub-live` — **generado, no
se edita a mano**.

## Dónde está ahora

- Vistas: Hoy, Tareas, Calendario, Proyectos, Inbox, Biblioteca y **Herramientas**.
- Interfaz móvil: cinco destinos en la barra inferior (Hoy, Tareas, Proyectos,
  Herramientas, Más). Calendario, Inbox, Biblioteca y Alta viven en la hoja Más.
- Sistema visual renovado el 13/08: fondo cálido, verde Studio32, superficies con
  profundidad ligera, tipografía más legible y el mismo ritmo en todas las vistas.
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
2. **Local** — abrir Claude Code y escribir **`/prospectar`**. Lee la
   cola él mismo, genera cada tanda y la sube. Sin copiar ni pegar nada.
   Corre con la **suscripción**, no por API: es la razón de que este paso sea local y
   no un worker en la nube.
   (`npm run outreach` sigue existiendo para mirar la cola a mano, y
   `npm run outreach -- tanda.json` para subir un JSON suelto.)

   **El comando está en dos sitios y no es un descuido:** Claude Code se abre desde la
   raíz del workspace, que NO es un repositorio, así que lo que se deje allí no viaja
   a la otra máquina. En la raíz hay un puntero de cinco líneas
   (`.claude/commands/prospectar.md`) y las instrucciones de verdad están aquí, en
   `.claude/commands/prospectar.md` de este repo, que sí se sincroniza. Manda el del
   repo. Mismo patrón que `CLAUDE.md` → `.ai/`.

   Si `/prospectar` sale como comando desconocido, **reinicia Claude Code**: los
   comandos se leen al arrancar la sesión.
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
- **La carpeta "Enviados" del webmail no es la prueba de nada.** SMTP entrega, pero la
  copia en Enviados la escribe el cliente por IMAP: son dos servicios distintos. Por eso
  los primeros envíos reales dejaban la carpeta vacía. Desde el 12/08 la función también
  escribe la copia (`imap.ts`), con la misma cuenta y sin secretos nuevos. **Lo que
  manda sigue siendo el estado en el Hub**, no la carpeta.
- **Tres fronteras en el envío:** aprobación humana explícita, lista de bajas, y no
  escribir dos veces a la misma dirección en 60 días.
- **La huella es esquema compartido con `studio32-agent`.** Si un lead convierte,
  alimenta `templates/<vertical>/`.

## Qué está probado (13/08) y qué no

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
| `npm run outreach` contra la base | ✅ responde |
| Pedir campaña desde el Hub | ✅ verificado: hay un pedido real esperando |
| `import-outreach.mjs` | ✅ probado con `scripts/outreach-ejemplo.json` |
| Deno deja salir el 993 (IMAP) | ✅ verificado el 12/08 |
| Copia en Enviados por IMAP | ✅ desplegada y **verificada con un envío real**: aparece en `INBOX.Sent` |
| Generar la tanda con la skill | ✅ ejecutado el 12/08: 4 leads reales de fisioterapia en la bandeja |
| Interfaz Herramientas/Prospección | ✅ revisada con datos reales a 375, 768 y 1280 px |
| Renovación visual completa | ✅ Hoy, Tareas, Calendario, Proyectos, Inbox, Biblioteca, Herramientas y proyecto real, escritorio y móvil |
| Pulso de Hoy | ✅ cuenta solo leads vivos y muestra la campaña real de los pendientes |

**La cadena entera está recorrida.** El 12/08 se ejecutó `/prospectar` contra la campaña
"Fisioterapia · Guadalajara" y subió 4 leads con sus 4 borradores. Sigue `pedida`→`abierta`
con 6 pendientes: la campaña pedía 10 y una pasada da para 6 como mucho.

Lo que enseñó la primera pasada real: **la puerta que descarta no es el correo, son las
citas literales de reseñas.** Ocho de nueve centros publicaban correo; solo cuatro tenían
una reseña con autor localizable. Está apuntado en `docs/PROSPECCION.md`, junto con el
detalle de que en fisioterapia las opiniones de Doctoralia cuelgan del profesional y no
del centro.

**Desplegar la función:** `npm run fn:deploy`. Lleva `--use-api` porque el empaquetado
local falla en este portátil (busca un `output.eszip` que no genera) y además ensucia el
repo con `doc/` y `supabase/.temp/`.

## Quien aprueba, firma y se queda el cliente

Decidido y hecho el 11/08. Aprobar no es solo un visto bueno: fija tres cosas a la vez.

- **El remitente pasa a ser el de quien aprueba.** Si aprueba Gonzalo, el correo sale de
  `gonzalo@studio32.es`. Lo escribe `approveMessage` en `src/outreach.ts` desde
  `src/remitentes.json`, que por eso ya no es un archivo huérfano.
- **El lead queda marcado con `owner_member_id`.** Todas las respuestas caen en el mismo
  buzón de Hostinger, así que si no consta el dueño, no consta: sin esto no se puede
  saber a quién le toca seguir la conversación.
- **La firma la compone el envío**, no la skill. `outreach-send` la deriva del propio
  `from` del mensaje. Por eso reasignar remitente es seguro por construcción: no hay un
  nombre incrustado en el cuerpo que se quede desfasado.

**La skill NO debe escribir firma.** El cuerpo termina en "Un saludo," y nada más. Si
alguna vez vuelve a escribirla, saldrá duplicada.

El nombre se saca del `from` (`Gonzalo · Studio32 <gonzalo@studio32.es>` firma Gonzalo)
para no mantener una tabla de socios en dos sitios. Ojo: Pancho firma **Francisco**,
porque su alias es `francisco@` y sería raro que el nombre y el correo no coincidieran
delante de un cliente.

## Lo que sigue sin resolver

- **Nadie lee el buzón.** Si un negocio responde BAJA, esa respuesta llega a Hostinger y
  se queda ahí: una persona tiene que verla y pulsar "No escribir más" en el Hub.
  Automatizarlo pide IMAP, y eso es meter las credenciales del buzón en otro sitio.
- **No hay página de bajas.** El pie del correo pide responder BAJA. La tabla ya tiene
  `unsubscribe_token` por lead, así que una página que reciba el token y escriba la baja
  sola cerraría el ciclo. Es lo más barato que queda por hacer.
- **Queda pulido visual adicional, no un rediseño pendiente.** El 13/08 se rehizo la
  navegación móvil y la jerarquía de Prospección. Campaña, estado y calidad son filtros
  separados; las pruebas quedan fuera por defecto y Enviados funciona como historial.

## Ojo con esto

Hay un correo real preparado para **Clínica Dental Dr. Garcés** (`cdentaldrgarces@gmail.com`)
desde los datos semilla del 04/08. Estuvo marcado como `aprobado` sin que nadie lo hubiera
revisado, y una tanda de envío lo habría mandado. Se devolvió a `borrador` el 11/08.

**Antes de pulsar Enviar, mirar siempre qué hay en la cola de aprobados.** El diálogo de
confirmación lista los destinatarios: leerlo, no darle a aceptar.

**`from_email` tiene que ser un alias que exista en Hostinger.** Los que hay:
`info`, `citas`, `contacto`, `francisco`, `gonzalo`, `hello`, `juanma`, `kikos`,
`support`. **No existe `hola@`** — y sin embargo era lo que traían el seed del 04/08 y
`scripts/outreach-ejemplo.json`. Corregido en los dos el 11/08, pero es el tipo de error
que no se ve hasta que un envío falla.

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
