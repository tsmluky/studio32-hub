# Estado — studio32-hub

> Se **sobrescribe**, no se acumula. Última actualización: 2026-10-19 (calidad de tres completos y recorrido de Huella).

## Qué es

Centro de gestión de Studio32, principalmente para Pancho; posible comercial después. Vive en `hub.studio32.es`.
El código actual conserva los tres miembros originales; no se ha cambiado su acceso.

## Frente activo: Hub personal y asistente

- **Calidad 19/10:** revisión de tres completos y fuentes guardadas; los tres requieren revisión editorial/técnica.
  Dictamen con nombres en el repo privado `Visibilidad-IA`, `REVISION-INFORMES-2026-10-19.md`; no publicar aquí
  datos ni hallazgos particulares. Estándar/recorrido en ese repo: `CALIDAD-INFORMES.md`, `RECORRIDO-INFORMES.md`.
- Pancho pide cobertura SEO + visibilidad IA y portar Huella de la skill de prospección de Claude. Origen encontrado
  en escritorio: `skills/studio32-lead-prospector/`; Modo C, schema histórico y huella premium son contratos distintos.
  `calidad-informes/PORTADO-HUELLA.md` detalla capacidades/consumidores. El completo móvil actual llama auditor/renderer;
  **no ejecuta ficha/huella ni toda la skill**. Ambas copias de `restaurante-ia` del motor se unifican y validan.
- Validador aislado v1: **37 regresiones** correctas; hashes/citas/sedes, cobertura, desconocidos, denominadores,
  métodos y revisión humana ligada a manifiesto/documento. No certifica semántica. Ejemplo privado generado con dos
  fuentes reales: borrador documental válido, rechazo de entrega como completo actual (salida 3).
  Datos y HTML en `.local/quality-reports/`, ignorados por Git. Pendiente portar investigación y completar detectores,
  adaptar salidas al contrato y conectar control antes de publicar. No se modifica el flujo productivo ni PDF remotos.

- **Revisión 19/10:** Pancho confirma búsqueda y ambos PDF desde su teléfono: Xaruga, Reina 219. Registros reales:
  diagnóstico 1 A4 y completo 11 A4, 23/13 segundos originales; nombres, tipos, hashes y evidencias coherentes.
- Se encontraron los servicios parados y un registro de procesos antiguo. Restaurado el conjunto y corregido el lanzador:
  recupera solo servicios ausentes, conserva los activos por PID/fecha, archiva registros obsoletos y revierte solo lo nuevo si falla.
  Prueba real: caída de interfaz, recuperación de solo esa interfaz, cuatro servicios intactos y reapertura sin duplicados.
- Calidad: los textos heredados atribuían conclusiones de IA a etiquetas técnicas y proyectaban puestos del índice histórico.
  Adaptador aislado de Hub revisado: resultados/evidencias/limitaciones, prioridades útiles, sin puesto, porcentajes censales ni
  recomendaciones no medidas. No toca motor compartido ni su control comercial validado. Cachés nuevas diagnóstico v3/completo v2.
  Conserva PDF anteriores; biblioteca presenta la última versión de cada negocio/tipo. No se afirma antes/después.
- Nueva prueba pública autenticada a 375 px: búsqueda Xaruga → diagnóstico nuevo (14 s) → completo pedido a Qwen (motor 10 s)
  → descarga por botón y enlaces. PDF nuevos 245.589/470.571 bytes, 1/11 A4, hashes verificados y revisión visual.
  22 pruebas núcleo/política + 12 Python + 8 HTTP + 4 comprobaciones descarga/permisos; tres suites SQL con rollback,
  incluida recuperación de leases de ambas colas. TypeScript/build correctos. Evidencias `.local/report-worker/qa-2026-10-19/`.


- **Mi estudio**, en `src/operations/` y como entrada de la aplicación autenticada: Mi mesa, Negocios, Asistente
  y Actividad; móvil probado a 375 px y herramientas anteriores accesibles. Sin cambiar miembros ni sus permisos.
- `Abrir mi estudio.cmd` arranca interfaz, servicio y Ollama; `Detener mi estudio.cmd` cierra solo sus procesos.
  URL `http://127.0.0.1:4310/mesa.html`. Preview local sin credenciales, excluida del build público.
- Lectura real de 8 fichas y 8 PDF del motor, con fuentes/fechas y prioridad de seguridad. No modifica el motor.
  En la preview, Qwen3.5 4B consulta esas fichas. En producción, el catálogo sale de los documentos del workspace.
- Notas, visitas, conversaciones y propuestas en SQLite local por usuario; snapshots/cola remotos privados en Supabase, fuera de payload/Git. Validación externa de
  negocio/hora, confirmación editable, transacciones e idempotencia. Contexto del modelo acotado.
- Voz instalada: faster-whisper 1.2.1 + PyAV 16.1.0 + Whisper small CPU int8. Grabación/adjunto → texto editable;
  sin voz de salida. Audio sintético adjuntado desde el Hub publicado → Whisper PC → borrador editable, corregido y enviado; copia borrada. Voz/micrófono del teléfono sin aceptación explícita todavía; los registros muestran una transcripción terminada.
- TypeScript/build correctos, 22 pruebas núcleo/política y 8 comprobaciones HTTP. Navegador real: búsqueda→informe,
  propuesta doble, descarte y nota guardada/recuperada (nota de prueba retirada con copia; visitas reales: ninguna).
- Nombre/ciudad → confirmar local → encargo → progreso → PDF. Cola autenticada `ops_report_*`, RLS por propietario/workspace,
  bucket privado y worker saliente con leases. Migración aditiva aplicada solo al Supabase del Hub.
- Probado con Unsushi sin ficha preparada: auditoría actual → PDF A4 → subida privada → descarga idéntica por SHA-256.
  Caché siete días, fuentes guardadas y fallback OSM moderado. Sin APIs de pago, puertos públicos ni cambios a miembros/outreach.
- Cliente publicado usa sesión Supabase real; preview usa pasarela loopback sin claves en navegador. Asistente, voz y propuestas conectados por cola propia con aislamiento por usuario.
  Publicado en `hub.studio32.es` con autorización de Pancho: push `9969dc7`, Cloudflare Pages correcto,
  HTML/JS/CSS públicos verificados con RPC nuevas, proyecto Supabase correcto y sin credencial privada del worker.
  Pancho confirmó diagnóstico y completo desde su teléfono el 19/10; quedan 4G/impresión no especificados; no se atribuye una prueba de teléfono real a la vista responsive.
  Worker activo; tras reiniciar PC hay que arrancarlo. Operación/pruebas: `docs/INFORMES-DESDE-MOVIL.md`.
- Verificación posterior a la crítica de Pancho: antes faltaba probar la UI pública autenticada. Con su sesión iniciada,
  reproducido «Asiers burger» sin resultados. El buscador no es un buscador general de Internet: mapa/registro tienen lagunas.
  Añadida salida para indicar web, comprobar nombre en título/JSON-LD y guardarla en caché propia para búsquedas posteriores.
- E2E real Asiers: búsqueda vacía → web indicada/verificada → selección → encargo público → auditoría/PDF nuevo en PC
  → descarga desde enlace y botón del navegador autenticado. 384.741 bytes, SHA-256 igual a Storage, A4 renderizado/revisado.
  Worker detenido con otro encargo en cola: persistió al salir de pantalla, terminó tras reinicio; PDF previo descargable.
  No se completó un ensayo de caída durante una auditoría activa (terminó antes de la interrupción). No atribuirlo a lo probado.
- Más/Herramientas conserva la navegación nueva y monta Prospección dentro. Activación de consultas/subscripción solo al abrirla;
  campañas reales e historial de 274 correos comprobados, sin aprobar, enviar ni modificar automatización.
  Inicio remoto prioriza informes.
- Corrección tras nueva prueba de Pancho: asistente y completo no estaban conectados. Ahora se añaden cola `ops_assistant_*`,
  snapshots privados por usuario, Qwen/Whisper locales y worker independiente. Informe completo de web actual, todos los checks
  y plan de arreglos, sin simular antes/después ni recomendaciones. SQL/RLS y 22 pruebas de núcleo/política correctas.
  Prueba pública autenticada real a 375 px: pedir completo al agente → tarjeta de encargo → PC → Storage → descarga por botón
  y por enlace del agente. Asiers: 11 páginas A4, 27 checks incluidos, 626.486 bytes, hashes idénticos. PDF renderizado/revisado.
  Pedido directo «Pedir completo» de Unsushi también completado desde la biblioteca pública, recuperado al cambiar de pantalla.
  Propuesta de nota remota revisada y descartada sin guardarla. Audio sintético confundió el nombre: corrección editable comprobada.
  Evidencias `.local/report-worker/assistant-complete-e2e.json`. No sustituye probar micrófono/Safari/Chrome/4G del teléfono real.

**Se publica solo: push a `main` y Cloudflare Pages lo despliega.** Nada que ejecutar.
El repo gemelo `studio32-hub-live` **está muerto** — era el despliegue por GitHub Pages,
su último commit es del 20/07 y producción sirve otro bundle. Actualizarlo no publica
nada. Comprobado el 15/08.

## Dónde está ahora

- Vistas: **Mi estudio** abre el espacio personal; siguen Hoy, Tareas, Calendario, Proyectos, Inbox, Biblioteca y Herramientas.
- Móvil personal: Mi mesa, Negocios, Asistente, Actividad y Más. En las herramientas previas: Mi estudio,
  Tareas, Proyectos, Herramientas y Más; Hoy pasa a la hoja secundaria.
- Entre 721 y 920px se usa **escritorio compacto**: sidebar de 190px y topbar de
  escritorio. La barra móvil queda reservada para 720px o menos.
- Sistema visual renovado el 13/08: fondo cálido, verde Studio32, superficies con
  profundidad ligera, tipografía más legible y el mismo ritmo en todas las vistas.
- Tablas: `workspaces`, `workspace_members`, `hub_states` y `outreach_*` (5, con `outreach_settings`).
- **Base de datos (22/09): este proyecto (`studio32-hub`, ref `wwhinwxedcvpxprmcsta`) es ahora el único proyecto Supabase de todo el ecosistema** — agente, panel y Hub juntos. El 20/09 el Hub se había movido a `studio32-agent-platform`; ese proyecto se borró por error el 21/09 (nunca lo toques desde aquí, ya no existe) y el esquema del agente se reaplicó sobre este. Las migraciones propias del Hub (0006-0009 en `studio32-agent/supabase/migrations`, copiadas allí el 20/09) quedan sin efecto: este repo vuelve a ser dueño de las suyas (`supabase/migrations`, las 4 originales). Detalle del incidente en `studio32-agent/.ai/DECISIONS.md` (22/09) y `Studio32/reportes/2026-09-22-incidente-supabase.md`.
- Repo hermano `studio32-hub-agent` (bot de Telegram, en Railway).

## Aviso: esto se construyó tres veces

Hubo dos implementaciones paralelas de la prospección, hechas en máquinas distintas sin
saber la una de la otra: `feat/prospeccion-email` (sobremesa, 04/08, esquema
`outreach_*` ya aplicado en producción) y la tabla `leads` de `main` (portátil, 07/08,
nunca aplicada). El 11/08 se fusionaron: **gana `outreach_*`**.

**Antes de tocar prospección, mira si ya existe.** El coste de no hacerlo ya son tres
intentos. `git branch -r` y una consulta al esquema de Supabase cuestan un minuto.

**La rama buena es `main`, siempre.** Quedan dos ramas remotas cuyos nombres suenan a
trabajo activo y no lo son: `feat/prospeccion-email` y `merge/prospeccion-unificada`.
Comprobado el 15/08/2026: **las dos están enteramente fusionadas en `main`**, cero
commits exclusivos en cualquiera de ellas. Son restos de la unificación del 11/08.

Si te encuentras el checkout en una de ellas —le pasó al sobremesa el 15/08, con `main`
local 39 commits por detrás— no hay nada que rescatar: `git checkout main` y
`git pull --rebase`. Lo que despista es que la regla de arriba dice "comprueba las
ramas", y al comprobarlas aparecen dos candidatas plausibles; por eso queda escrito
aquí cuál gana. Borrarlas sería lo limpio, pero es una acción sobre el remoto
compartido y la decide una persona.

## Herramientas · Prospección — el ciclo

**24/09: aprobación automática encendida.** Un borrador que pasa la revisión automática
(`_shared/reglas-correo.js`, que también aplica el envío a todo) y lleva 24 h sin tocarse
se aprueba solo, firmado por Francisco. Editarlo reinicia el plazo; descartarlo lo frena.
Se apaga con `aprobacion_automatica` en `outreach_settings` (aún no hay botón en el Hub;
el Hub sí enseña en cada borrador cuándo se aprobará y qué pararía la revisión).
`npm run outreach:revisar` pasa las reglas a la cola sin enviar. Cupo: 30/día desde el
28/09 y ahí se queda. Porqué en `DECISIONS.md`.

**27/09: "no se envía nada" en fin de semana es el diseño, no un fallo.** El cron
(`*/10 7-18 * * 1-5`) no llama a la función ni un sábado ni un domingo; confirmado en
`cron.job_run_details` (última fila del viernes 25 a las 18:10 UTC, ninguna el sábado ni
el domingo). Fuera de eso apareció y se corrigió un problema real: una sesión de
sobremesa redesplegó `outreach-rewrite` el 24/09 con checkout viejo, 11 min después de
que `main` llevara ya el commit que cambiaba el asunto, y pisó esa decisión en el
servidor. `outreach-rewrite` y `outreach-send` redesplegados ya sincronizados con `main`.
**Antes de tocar prospección: `git pull --rebase` primero, siempre** (la regla de más
abajo, que esto acaba de incumplir). Detalle completo en `DECISIONS.md`.

**02/10: pauta nueva del correo, evidencia → fricción → solución → pregunta.** Una
personalización, una fricción vista al pedir cita, "Es justo lo que montamos: …" ligada a
ella y "¿Os enseño cómo funcionaría aplicado a vuestra clínica?"; 100-140 palabras. **Ya no
hay frase de "otros servicios"** (revierte la del 24/09): un solo producto, el de la oferta.
Asunto llano, con curiosidad moderada ("Sobre las citas de X", "Una idea sobre vuestra agenda").
Sin fricción vista, el lead no sube. `evidencia` lleva `rol`, `confianza` y `angulo`. Las
reglas de estilo nuevas (`revisarEstilo`) son **avisos**, no puerta: no paran el envío.
**Hecho solo en el repo: falta redesplegar `outreach-rewrite` y los borradores en cola siguen
en la estructura del 24/09.** Porqué, y qué reglas conviene subir a puerta, en `DECISIONS.md`.

**15/09: estructura nueva del correo, acordada con Juanma.** "Hola, soy X, de Studio32."
(lo pone el envío) → algo bueno y concreto de ellos → lo que falla, comprobado → "Es
justo lo que montamos: …" en primera persona → "¿Os enseño cómo funciona?" → "Un saludo
y gracias por vuestro tiempo,". Nunca se ofrecen llamadas (el agente es solo WhatsApp),
ni "ejemplo real", ni responder en otros idiomas (el tono de cada tenant fija español).
Los 63 borradores en cola se reescribieron así ese día. Porqué en `DECISIONS.md`.
Mismo día: **botón "Reescribir con IA"** en cada borrador (función `outreach-rewrite`,
OpenAI con la clave del agente, `npm run fn:deploy:rewrite`). Propone en el editor y no
guarda nada por sí sola.

**12/09: la frase de oferta y un solo tratamiento (tú/vosotros) son puerta, no estilo.**
Siguen vigentes; `SKILL.md` (modo C) y `outreach-guidelines.md` lo piden como requisito.

1. **Hub** — Herramientas › Prospección › "Pedir campaña": sector, zona, oferta,
   cantidad y notas. Nace en estado `pedida`, sin leads.
2. **Local** — abrir Claude Code y escribir **`/prospectar`** (o `/prospectar 2`). Lee la
   cola él mismo, **trabaja 3 campañas a la vez con un agente cada una** (14/09), genera
   cada tanda y la sube. Sin copiar ni pegar nada. En el portátil de Pancho hay además
   una rutina de la app de escritorio, "Prospectar (Studio32) · tanda de la mañana",
   que hace lo mismo con un botón; es local de esa máquina, no viaja con el repo.
   La cola (`npm run outreach`) lista desde el 14/09 también las campañas `abierta` con
   leads por generar —antes solo las `pedida`, y 16 con trabajo pendiente no se veían—.
   Desde el 25/09 cada campaña da hasta 30 leads por pasada, la cantidad pedida ya no es
   techo, no hay tope de bandeja, y `/prospectar` crea campañas (`--crear`) si faltan.
   Un correo por negocio para siempre: lo aplican el importador y `outreach-send`.
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
5. **Edge Function `outreach-send`** — envía por SMTP de Hostinger. A mano con
   "Enviar", o **sola** si el envío automático está encendido en el Hub (14/09): pg_cron
   la llama cada 10 min y reparte lo aprobado de lunes a viernes, 9:30-19:00 de Madrid,
   dentro del cupo y con 30 min de margen tras aprobar. A la primera que el SMTP
   rechaza un correo, se apaga sola y deja el motivo en el Hub.

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
- **Y un cupo diario por encima (14/09):** 10/20/30 al día por semana desde el 14/09,
  para todo el dominio. Lo aplica `outreach-send`; lo que no cabe queda aprobado para
  mañana. Porqué en `DECISIONS.md`.
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
| Generar la tanda con la skill | ✅ 12/08 (4 fisio), 15/08 (6 dentales·valencia), 16/08 (6 dentales·barcelona, 4 dentales·azuqueca, 6 estética·valencia, 3 estética·valencia-amistat) |
| Cerrar campaña agotada (`--cerrar`) | ✅ 16/08: "Clínicas dentales · azuqueca de henares", 4 de 10 pedidos, pueblo sin más candidatas |
| Interfaz Herramientas/Prospección | ✅ revisada con datos reales a 375, 768 y 1280 px |
| Renovación visual completa | ✅ Hoy, Tareas, Calendario, Proyectos, Inbox, Biblioteca, Herramientas y proyecto real, escritorio y móvil |
| Pulso de Hoy | ✅ cuenta solo leads vivos y muestra la campaña real de los pendientes |
| Portada y cola dicen lo mismo | ✅ 15/08: 3 y 3, ya sin rodeo — los 7 huérfanos se borraron |
| Controles de Prospección | ✅ 15/08: sin recorte ni desborde a 375, 900, 1024 y 1280 |
| Reescribir el correo antes de aprobar | ✅ **probado en producción el 12/09**: 29 borradores reales corregidos a mano desde el editor del Hub |
| Cupo diario en la función | ✅ desplegado 14/09; la cuenta del día no se ha visto aún con un envío real |
| pg_cron → función con el secreto | ✅ 14/09: llamada real desde la base, respondió "Envío automático apagado" |
| Envío automático encendido, enviando de verdad | ❌ **sin probar**: nace apagado; la primera vez que se encienda, mirar el Historial |
| Interruptor y cupo en la vista | ⚠️ compila y se publicó; no revisado con sesión iniciada |
| `/prospectar` con 3 agentes en paralelo | ❌ **sin probar** con una pasada real |

**Secretos del envío programado** (fuera del repo, puestos el 14/09): `OUTREACH_CRON_SECRET`
en la función, y en Vault `outreach_cron_secret` (mismo valor) y `outreach_anon_key`. Si
se rota uno, se rotan los dos lados o el reloj deja de entrar.
La migración se aplicó con `npx supabase db query --linked -f <archivo>` porque
`SUPABASE_DB_URL` está vacía en el `.env` del portátil.

**La cadena entera está recorrida.** El 12/08 se ejecutó `/prospectar` contra la campaña
"Fisioterapia · Guadalajara" y subió 4 leads con sus 4 borradores. Sigue `pedida`→`abierta`
con 6 pendientes: la campaña pedía 10 y una pasada da para 6 como mucho.

Lo que enseñó la primera pasada real: **la puerta que descarta no es el correo, son las
citas literales de reseñas.** Ocho de nueve centros publicaban correo; solo cuatro tenían
una reseña con autor localizable. Está apuntado en `docs/PROSPECCION.md`, junto con el
detalle de que en fisioterapia las opiniones de Doctoralia cuelgan del profesional y no
del centro.

El 15/08 se sirvió la campaña "Clínicas dentales · valencia" (pedía 15): **6 leads con
sus 6 borradores**, sigue `abierta` con 9 por generar. En dentales la puerta que descarta
es la contraria, el **correo**: reseñas hay de sobra, pero cinco de doce clínicas con web
propia no publican ninguna dirección. También en `docs/PROSPECCION.md`, con los dos
atajos que ahorran tiempo (salir del listado de Doctoralia, y mirar el aviso legal antes
de descartar por falta de correo).

El 16/08 se sirvió "Clínicas dentales · barcelona" (pedía 15): **6 leads con sus 6
borradores**, sigue `abierta` con 9 por generar. En Barcelona el correo no fue el
problema (8 de 10 candidatas lo publicaban): el hueco digital que sostuvo casi todos
los correos fue que la clínica ya tiene tracción real (100-380 reseñas) pero el primer
contacto sigue siendo un WhatsApp atendido a mano o un botón de "reservar" que en
realidad abre ese mismo WhatsApp sin agenda detrás. El 16/08 se sirvió también "Clínicas dentales · azuqueca de henares" (pedía 10): solo
**4 leads**, y se cerró como agotada — mismo patrón que fisioterapia en la misma zona,
el correo no es el problema, las reseñas citables sí. Detalle de quién cayó y por qué en
`docs/PROSPECCION.md` → "Zonas ya exprimidas".

El 16/08 se sirvió también "Centros de estética · Valencia" (pedía 40): **6 leads con
sus 6 borradores**, primera vez que se prueba este sector — sigue `abierta` con 34 por
generar. Funciona por correo (8 de 10 candidatas de Treatwell lo publicaban) y Treatwell
resultó ser la fuente de reseñas del sector, no Doctoralia (este apenas tiene fichas de
estética). Detalle en `docs/PROSPECCION.md`, incluido un obstáculo nuevo: correo
protegido con ofuscación Cloudflare, visible para un humano pero no copiable por una
carga automatizada — costó 2 leads (Onírika, Cosméticaclub).

El 16/08 se sirvió también una campaña nueva y distinta de la anterior: "Centros de
estética · Valencia, zona amistat, ayora, bblasco ibañez y cercanía" (pedía 25, zona
mucho más estrecha). Solo **3 leads**: Fabiola Carreño Estéticas, Xanadel y Laura
Olcina, las tres con reseñas que nombran al profesional en persona, no al centro. El
obstáculo no fue el correo (las tres lo publicaban en su propia web) sino el volumen de
negocios reales dentro de una zona tan pequeña — varios candidatos de la búsqueda
inicial resultaron estar fuera de la zona pedida (Ciutat Vella, La Saïdia, Benicalap)
pese a salir en las mismas búsquedas. Dos dominios que un buscador daba por buenos
(mimateyavalencia.com, monikversatilestyles.es) no resolvían al cargarlos de verdad, así
que esos leads se descartaron sin subir un email sin verificar de primera mano. Sigue
`abierta` con 22 por generar.

El 05/09/2026 se sirvió "Clínicas dentales · Alicante capital" (pedía 20, solo clínicas
privadas independientes, valorando idiomas por el paciente extranjero de la zona):
**6 leads con sus 6 borradores** — Clínica Dental Benalúa, Clínica Dental UC (Ugedo y
Chaves), Ridere Estudio Dental, Clínica Dental Novodent, Centro Dental García Lacal y
Clínica Dental Gallud & Marié. Sigue `abierta` con 14 por generar. El correo no fue el
cuello de botella (todas las candidatas verificadas lo publicaban) ni tampoco las
reseñas (Google Maps, no Doctoralia, fue la fuente que más citas literales con autor
dio en este sector). Trampa nueva encontrada y anotada en `docs/PROSPECCION.md`: un
negocio puede compartir nombre con otro de una ciudad distinta — `clinicasdrfonseca.com`
resultó ser una clínica de Mérida, no la de Alicante del mismo nombre, y se descartó sin
subir nada al no poder verificarlo.

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

**La skill NO debe escribir ni saludo ni firma.** El cuerpo empieza por lo que se vio del
negocio y termina en "Un saludo y gracias por vuestro tiempo," sin nombre. Desde el
15/09 el envío antepone "Hola, soy X, de Studio32." con el mismo nombre que la firma, y
quita una línea "Hola… Studio32" si el cuerpo ya la traía, para que no salga doble ni con
otro nombre. La vista previa del Hub enseña las dos piezas atenuadas.

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

**Antes de pulsar Enviar, mirar siempre qué hay en la cola de aprobados.** El diálogo de
confirmación lista los destinatarios: leerlo, no darle a aceptar. Viene de un susto real:
el seed del 04/08 dejó un correo a **Clínica Dental Dr. Garcés** marcado como `aprobado`
sin que nadie lo hubiera revisado, y una tanda de envío lo habría mandado. Se devolvió a
`borrador` el 11/08 y el lead se borró el 15/08 al limpiar los descartados.

**Descartar borra el lead y su borrador** (15/08). Un negocio descartado puede volver en
una tanda futura si pasa la puerta — es deliberado. Lo que no vuelve nunca es quien esté
en la lista de bajas, que va por dirección y sobrevive a todo. Un lead con correo ya
enviado no se borra: se marca, porque la FK es `on delete cascade` y la cascada se
saltaría las políticas que protegen lo enviado.

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
