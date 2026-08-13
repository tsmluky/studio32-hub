# Decisiones — studio32-hub

Append-only. Fecha · decisión · por qué. Lo más reciente al final.

---

## 2026-08-07 · Adoptar la convención `.ai/` en este repo

Este repo se había quedado fuera: solo tenía un `.openai/` vacío, sin `STATE.md` ni
punteros. Es el repo que más se trabaja desde dos máquinas, y perder el hilo entre
portátil y sobremesa ya costó una tentativa fallida de esta misma funcionalidad.

---

## 2026-08-07 · La skill de prospección vive en el repo, no en AppData

`studio32-lead-prospector` estaba únicamente en
`AppData/Roaming/Claude/local-agent-mode-sessions/...` — una carpeta de sesión de la
app de escritorio. No se sincronizaba entre máquinas y podía desaparecer sin aviso.

Ahora la fuente de verdad es `skills/studio32-lead-prospector/` en este repo. La copia
que usa la app de escritorio es un derivado: si se edita allí, se pierde.

---

## 2026-08-07 · La bandeja de prospección va en studio32-hub, no en un repo nuevo

Las cinco piezas (skill, esquema, tabla, vista, envío) están acopladas a la misma
tabla de Supabase. Separarlas en repos obligaría a sincronizar migraciones entre
ellos. Un solo repo, un solo `STATE.md`.

---

## 2026-08-07 · Los leads van en tabla propia, no en `hub_states.payload`

El `payload` se reescribe entero en cada guardado. Un lead lleva huella, porqué y
correo redactado: en cuanto haya unas decenas, cada cambio del hub estaría moviendo
cientos de KB. Tabla `leads` aparte, con el mismo patrón de RLS.

---

## 2026-08-07 · El envío sale del buzón personal de cada socio, no de `info@`

Descartados Resend y similares: son suscripción, y montarlos implica verificar
dominio, gestionar rebotes y construir el camino de vuelta de las respuestas.

Se usa SMTP de Gmail con App Password, el mismo patrón que ya funciona en
`studio32-agent`. Desde el buzón real de Juanma o Gonzalo, no desde `info@`:

- Las respuestas caen en su bandeja y la conversación sigue sola.
- Un correo frío firmado por una persona con nombre se lee distinto que uno de `info@`.
- Si algo se marca como spam, se quema una cuenta personal, no la dirección que usa
  todo el negocio.

Envío desde local, en tandas cortas (20-30/día con pausa entre envíos), no en ráfagas.

---

## 2026-08-07 · App Password ahora, OAuth `gmail.send` cuando deje de ser suficiente

Una App Password da acceso completo al buzón por IMAP/SMTP, saltándose el 2FA — no es
"permiso para enviar". Siendo tres socios se asume conscientemente.

**Disparador de migración:** el día que entre alguien que no sea socio, se pasa a OAuth
con scope `gmail.send`, que concede solo enviar. No antes.

---

## 2026-08-07 · El `sender_id` se fija al redactar, no al enviar

El correo se escribe *para* una persona: su firma, su voz. Elegir remitente en el
momento de enviar obligaría a reescribir la firma sobre la marcha o a mandar un correo
firmado por quien no es. El lead lleva `sender_id` desde que sube; cambiarlo en el hub
re-firma el borrador.

Se reutiliza el tipo `MemberId` que ya existe (`juanma | pancho | gonzalo`).

---

## 2026-08-07 · La huella es un esquema compartido con studio32-agent

La huella que se mina para redactar el correo es la misma que arranca la configuración
del tenant si el lead convierte: vertical, lema, cómo hablan sus clientes, léxico real,
lo que ya funciona. El trabajo de captación no se tira, es el primer paso del alta.

Implica que el esquema tiene dos consumidores: cambiarlo afecta a los dos lados.

---

## 2026-08-07 · Evidencia o silencio: la puerta antes de subir al hub

Todo campo interpretativo de la huella viaja con evidencia, fuente y nivel de
confianza. Lo de confianza `baja` orienta el ángulo pero **no puede aparecer en el
correo**.

Un lead no sube si le falta: un dolor con confianza alta o media, un ángulo redactable
en una frase, email de contacto público, o coherencia entre lo que afirma y lo que
realmente se verificó.

**Por qué es una puerta y no un consejo:** el valor de la bandeja depende por completo
de que Juanma se fíe de ella. En cuanto tenga relleno, dejará de abrirla, y la
herramienta se acaba. Seis leads sólidos valen más que veinte con ruido.

---

## 2026-08-11 · "Herramientas" es una sección propia, no una vista suelta

Prospección iba a ser una entrada más del menú. Se convierte en la primera herramienta
dentro de un contenedor "Herramientas", porque van a venir más y el menú principal es
para las vistas del día a día (Hoy, Tareas, Calendario...), no para utilidades internas.

En escritorio el sidebar lista las herramientas bajo su título. En móvil el sidebar es
una barra inferior de iconos y no cabe un submenú: por eso existe además una pantalla
índice. Una entrada en el menú, una pantalla, y dentro la lista. Añadir una herramienta
nueva es añadir una entrada a `tools` en `src/ToolsView.tsx`.

---

## 2026-08-11 · El cuerpo del correo no lleva firma: se compone al enviar

Corrige la decisión del 2026-08-07 ("el sender_id se fija al redactar"). Aquella decía
que elegir remitente al enviar obligaría a reescribir la firma sobre la marcha. La
salida es no meter la firma en el texto.

El `sender_id` que sube la skill pasa a ser una **sugerencia razonada**: el correo se
redacta en la voz de esa persona, con su cierre. Pero el bloque de nombre y contacto lo
compone el envío desde `src/remitentes.json`, con el `sender_id` que tenga el lead en
ese momento. Reasignar remitente en el hub es entonces una operación segura.

**Por qué importa que quien aprueba pueda quedárselo:** la respuesta cae en el buzón de
quien firma. Si Gonzalo aprueba y el correo sale de Juanma, la conversación arranca en
un buzón que no es el de quien decidió seguirla. El botón "lo envío yo" lo arregla en un
toque, y por defecto se respeta el remitente sugerido.

`src/remitentes.json` es fuente única: lo leen el hub (para previsualizar) y el script
de envío (para enviar). Si divergieran, lo que se aprueba dejaría de ser lo que sale.

---

## 2026-08-11 · Deduplicar por dominio propio, no solo por email

El índice único por email no impedía escribir a `info@clinica.es` y a `citas@clinica.es`:
dos correos al mismo negocio, que es exactamente lo que hace que a uno lo marquen como
spam.

Se añade `leads.dominio` con índice único parcial. Lo calcula el script de subida, no la
base de datos, porque solo cuenta cuando el dominio es propio: dos negocios distintos
pueden usar los dos `gmail.com`. En proveedores gratuitos queda a null y esas filas se
deduplican solo por email, como antes.

---

## 2026-08-11 · Cerrar el ciclo a mano: 'respondido' y 'no_interesa'

Las respuestas llegan al Gmail personal de quien firmó, no al hub. Sin una forma de
marcar qué pasó, la bandeja se quedaba en 'enviado' para siempre y no había manera de
saber a quién ya se le hizo caso.

Se descartó leer el buzón por IMAP para detectarlo solo: obligaría a que el hub tuviera
acceso de lectura a los correos personales de los socios, que es mucho más de lo que
esta herramienta necesita. Dos botones en la tarjeta cuestan un segundo y no piden
ningún permiso nuevo.

`fallido` pasa a poder volver a `aprobado` para reintentar. El hub sigue sin poder
marcar nada como `enviado`: eso solo lo hace quien realmente envió.

---

## 2026-08-11 · PageHeading y EmptyState salen de App.tsx a src/ui.tsx

Dos vistas en archivos distintos no pueden importarlas de `App.tsx` sin crear un ciclo,
porque `App.tsx` importa las vistas. Se extrae lo que se toca, no más: el resto de
`App.tsx` se queda donde está hasta que haga falta tocarlo.

---

## 2026-08-11 · Gana outreach_*, y la leccion de por que hubo dos

Se construyo la misma funcionalidad dos veces, en dos maquinas, sin que ninguna
supiera de la otra. La rama `feat/prospeccion-email` (sobremesa) tenia el esquema
mejor y ya aplicado en produccion; `main` (portatil) tenia la puerta de evidencia y
el envio propio. Se fusionan: gana el esquema, se conserva la disciplina.

Gana `outreach_*` porque separa mensajes de leads —lo que permite seguimientos—, y
porque la lista de bajas, el corte de 60 dias y los duplicados blandos ya estaban
resueltos alli.

**La leccion, y por eso esto esta escrito aqui:** `STATE.md` avisaba de que ya habia
habido una tentativa fallida por perder el hilo entre maquinas, y aun asi paso otra
vez. Lo que fallo no fue la documentacion: fue no mirar `git branch -r` ni el esquema
real de Supabase antes de empezar. Un minuto de comprobacion contra dos dias de
trabajo duplicado.

---

## 2026-08-11 · La campana se pide desde el Hub y se genera en local

El cuello de botella no era generar leads: era que solo una persona podia decidir a
quien atacar, porque era la unica que sabia ejecutar la skill.

Ahora la campana nace en estado `pedida` desde un formulario del Hub —sector, zona,
oferta, cantidad, notas— y `npm run outreach:pendientes` la recoge en local y compone
el prompt. Juanma y Gonzalo piden desde el movil sin saber ejecutar nada.

**Por que la generacion no se automatiza en la nube:** correria por API y facturaria
por token. En local corre con la suscripcion de Claude Code y cuesta cero. Ademas, la
calidad de estos correos es justo lo que no conviene dejar sin que nadie mire.

**Por que el Hub no puede lanzarlo solo:** es un sitio estatico y no alcanza el
portatil. La conexion solo va en un sentido, asi que el encargo se deja en la mesa.

---

## 2026-08-11 · Envio por SMTP de Hostinger desde una Edge Function, no Resend ni Railway

Studio32 tiene UNA cuenta real, `info@studio32.es`, con alias por socio. El SMTP se
autentica como la cuenta y pone el alias en `From:`, igual que hace el webmail. Sale
del dominio propio, las respuestas caen en la bandeja real y no hay proveedor
intermedio.

Se descarto Resend (que era lo que traia la rama) por decision del usuario: no querer
depender de una suscripcion de terceros para algo que el dominio propio ya hace.

Se descarto Railway pese a estar elegido inicialmente: **el plan Hobby bloquea el SMTP
saliente** (25/465/587), que solo se abre en Pro. Se comprobo el plan antes de
construir nada. La Edge Function de Supabase si permite el 465 con TLS.

Queda sin verificar que Hostinger acepte por SMTP el `From:` con alias. En el webmail
si. Si no lo aceptara, se envia todo desde `info@` con el nombre del socio visible.

---

## 2026-08-11 · Pancho por dentro, Francisco por fuera

El id interno es `pancho` (login del Hub, `outreach_leads.owner_member_id`, el tipo
`MemberId`) pero su direccion real es `francisco@studio32.es`. No existe alias
`pancho@`.

Se deja asi en vez de unificar: cambiar el id obliga a migrar el login y los datos ya
guardados, y no gana nada. El cruce vive en un solo sitio, `src/remitentes.json`.

---

## 2026-08-11 · CORS: se permite cualquier localhost, y por que no afloja nada

`allowedOrigins` enumeraba los puertos del dev server a mano y el 5175 no estaba. El
preflight se rechazaba, el navegador ni llegaba a mandar el POST, y en el Hub parecia
que la funcion no estaba desplegada: el mensaje se quedaba en 'aprobado' sin rastro de
error. Costo una prueba entera de diagnostico.

Ahora se acepta cualquier `http://localhost:PUERTO`. **CORS decide que pagina puede leer
la respuesta, no quien puede enviar**: quien envia sigue necesitando una sesion valida
de miembro del workspace, y eso lo comprueba `requireStudio32Member`. Confundir las dos
cosas es lo que lleva a listas de origenes que solo estorban.

---

## 2026-08-11 · La baja se registra por direccion, no por lead

`outreach_suppressions` existia desde el primer dia y el envio ya la comprobaba, pero no
habia forma de meter a nadie sin ir a la base de datos. Ahora hay boton en la tarjeta.

**Por que por direccion y no por lead:** descartar un lead lo saca de esta campana, pero
el mismo buzon puede volver manana dentro de otro negocio —una gestoria, una cadena, el
mismo sitio con otro nombre—. La baja tiene que sobrevivir a eso.

Pide confirmacion y no se deshace desde la interfaz. Deliberado: el error caro es el
contrario, volver a escribir a quien pidio que no.

Probado de verdad: se dio de baja, se reaprobo el mensaje a proposito, y el envio lo
rechazo con "La direccion esta dada de baja".

---

## 2026-08-11 · Dos fallos que enmascaraban el resultado del envio

Los dos hacian que el sistema **mintiera sobre lo que habia pasado**, que es peor que
fallar, y por eso quedan escritos:

1. `smtp.close()` de denomailer devuelve `void`, no una promesa. El `.catch()`
   encadenado lanzaba dentro del `finally` justo DESPUES de un envio correcto, y el
   mensaje quedaba marcado como `fallido` habiendo salido de verdad. Se descubrio porque
   llegaron dos correos cuando la base decia que ninguno.

2. `OUTREACH_UNSUBSCRIBE_BASE` valia literalmente la palabra "opcional", copiada de la
   plantilla del `.env.example`, que la escribia pegada al nombre como si fuera el valor.
   Los primeros correos reales salieron con un pie que decia "opcional?t=<token>". No lo
   canto nada porque no falla: el correo se entrega igual. Solo deja sin salida a quien
   quiera darse de baja. Ahora la base solo se usa si es una URL http(s) completa.

---

## 2026-08-11 · Quien aprueba firma y se queda el cliente

Corrige la decision del 07/08 ("el sender_id se fija al redactar") y cierra el agujero
que dejo la fusion, donde el remitente era por campana entera.

Al aprobar en el Hub se fijan tres cosas de golpe: el remitente pasa a ser el alias de
quien aprueba, el lead queda marcado con su `owner_member_id`, y la firma se compone en
el envio a partir de ese remitente.

**Por que importa el dueno:** todas las respuestas caen en el mismo buzon de Hostinger,
no en buzones separados. Sin `owner_member_id` no hay forma de saber a quien le toca
seguir la conversacion, y "cada uno mantiene sus propios clientes" se queda en intencion.

**Por que la firma se compone en el envio:** si viviera en el cuerpo, aprobar cambiaria
el remitente pero no la despedida, y saldria un correo firmado por quien no es. El
nombre se deriva del propio `from` en vez de mantener una tabla de socios en la Edge
Function ademas de en `src/remitentes.json`.

Efecto secundario a vigilar: si la skill vuelve a escribir la firma en el cuerpo, saldra
duplicada. Esta dicho en SKILL.md y en STATE.md.

---

## 2026-08-13 · Cinco destinos móviles y el resto en Más

La barra inferior llegó a ocho entradas. Cabían en píxeles, pero los textos quedaban
cortados y los objetivos táctiles eran demasiado pequeños. Se reduce a Hoy, Tareas,
Proyectos, Herramientas y Más. Calendario, Inbox, Biblioteca y Alta de asistente viven
en una hoja con descripción y contador. El patrón se usa hasta 920px: una tablet
vertical tampoco tiene espacio útil para simular el sidebar completo.

No se elimina ninguna ruta ni se cambia la navegación de escritorio. "Más" agrupa lo
secundario; no es un cajón para ocultar Herramientas, que sigue siendo destino principal.

---

## 2026-08-13 · Prospección se organiza por decisión, no por tablas

Campaña, estado del correo y calidad de evidencia son dimensiones distintas. La fila de
campañas pasa a ser un selector; el estado conserva tres pasos (Por revisar, Listos para
enviar, Historial) y "evidencia floja" es un filtro adicional, no una cuarta pestaña.

Las campañas de prueba siguen accesibles en un grupo propio, pero "Todas las campañas
reales" las excluye. El encaje muestra su nombre y escala, aprobar es la única acción
principal, y la baja permanente vive en "Más opciones". En Historial no se ofrece
Descartar: bloquear futuros contactos no puede hacer desaparecer un envío ya realizado.

---

## 2026-08-13 · El Hub se siente como un estudio operativo

La interfaz era limpia pero excesivamente plana: mucho blanco sin jerarquía, bordes
finos en todas partes y metadatos de 8-9px. Se conserva la arquitectura y se renueva el
sistema visual completo: lienzo cálido, verde profundo Studio32, superficies marfil,
radios más generosos, profundidad ligera y tamaños de lectura reales.

No se adopta un framework ni se rediseña vista por vista con estilos propios. Los
tokens y la capa compartida de `src/style.css` gobiernan Hoy, Tareas, Calendario,
Proyectos, Inbox, Biblioteca, Herramientas, diálogos y proyecto. Así una vista nueva
hereda identidad sin copiar CSS. Movimiento solo como respuesta breve y con
`prefers-reduced-motion`; la estética nunca puede reducir la comodidad operativa.
