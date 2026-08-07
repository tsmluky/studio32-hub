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
