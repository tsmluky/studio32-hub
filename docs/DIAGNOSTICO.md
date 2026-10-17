# Diagnóstico IA — de gancho del correo a producto

> Rumbo acordado el 17/10/2026. Es diseño, no código: nada de esto está construido.
> Porqué de cada decisión en `.ai/DECISIONS.md` (17/10).

## La idea en una frase

La auditoría digital que ya hace `/prospectar` se convierte en un **diagnóstico** con
nombre propio. Primero viaja en el correo frío; después, el negocio lo pide él solo en
una landing nuestra, y el informe completo se vende.

**Vocabulario:** se dice **diagnóstico**, nunca "mini informe" ni "mini auditoría". El
**informe completo** es lo que se vende: el diagnóstico más los pasos para arreglar
cada cosa.

## Fase 1 · Diagnóstico dentro del correo frío (lo siguiente)

- **30 diagnósticos al día, 30 correos al día.** Es el cupo de ahora y se queda así. Se
  planteó 50 y se bajó a 30: cada diagnóstico lo generamos nosotros y tiene que ser
  verdad.
- **Formato: una imagen dentro del correo**, ni PDF ni enlace. Pero el **hallazgo
  principal va también en el texto**. Hay tres motivos:
  - Muchos clientes de correo (Outlook, móviles de empresa) no enseñan las imágenes
    hasta que se pulsa "mostrar". Si todo va en la imagen, el correo llega vacío.
  - Un correo que es casi solo imagen es de lo que más puntúa como spam.
  - Una imagen incrustada técnicamente es un adjunto (`multipart/related`, `cid:`).
    Es más ligera y menos sospechosa que un PDF, pero no es "nada".
  - Regla: imagen de **menos de 150 KB**, ancho 600 px, con `alt` que diga lo mismo
    que el texto.
- **Se genera, no se diseña a mano.** La skill ya produce la `evidencia` (rol, confianza,
  ángulo) de cada lead. Esa evidencia se pinta en una plantilla HTML fija y Playwright
  hace la captura (Chromium ya está en el entorno). El coste por diagnóstico es casi
  cero y siempre sale igual.
- **Qué lleva la imagen:** nombre del negocio, 3 hallazgos como mucho (cada uno con su
  prueba: nota media, número de reseñas, lo que pasa al pedir cita), un semáforo por
  hallazgo y el pie "Diagnóstico Studio32 · fecha". **Sin precio.**
- **El cierre del correo** cambia de "¿Os enseño cómo funcionaría?" a ofrecer el informe
  completo ("¿Os paso el informe completo con cómo arreglarlo?").

### Lo que hay que construir para la fase 1

1. Plantilla del diagnóstico (HTML) + script de captura a JPG/PNG.
2. Guardar la imagen por lead. Va en Supabase Storage con RLS, **no** en
   `hub_states.payload` ni en una columna base64.
3. `outreach-send` pasa de texto plano a `multipart/alternative` (texto + HTML) con la
   imagen incrustada. Hoy envía solo `content` en texto plano.
4. Vista previa del diagnóstico en el borrador del Hub, para aprobarlo viéndolo.
5. Pauta del correo y `revisarCorreo`: el hallazgo tiene que ir en el texto, no solo en
   la imagen.

### Antes de subir nada de volumen

- **DMARC con `rua`.** Hoy es `p=none` sin `rua`, así que no hay forma de saber si
  llegamos. Registro TXT en Hostinger, en `_dmarc.studio32.es`:
  `v=DMARC1; p=none; rua=mailto:dmarc@studio32.es; fo=1`
  (el buzón tiene que existir; vale un alias nuevo o `info@`). Los informes llegan a
  diario en XML; con dos semanas ya se ve si SPF y DKIM pasan.
- **Página de bajas por token.** `outreach_leads.unsubscribe_token` ya existe y
  `outreach-send` ya usa `OUTREACH_UNSUBSCRIBE_BASE` si es una URL. Falta la página
  que recibe `?t=` y escribe la baja. Ojo: si ese secreto no está puesto, el pie cae a
  `mailto:bajas@studio32.es`, y **`bajas@` no está en la lista de alias de Hostinger**.
  Comprobarlo.

## Fase 2 · Landing de autodiagnóstico (después)

El negocio entra en la landing, escribe cómo se llama y dónde está, y la página:
1. Busca la ficha (Google Maps / web) y genera **su diagnóstico gratis**, el mismo
   formato que el del correo.
2. Enseña el **informe completo borroso con un precio**.
3. Pide el correo para mandarle el diagnóstico. Ahí hay **consentimiento**: a partir de
   este punto el seguimiento es legal y no cuenta como correo frío.
4. **Seguimiento a las 2 semanas:** "¿Seguís interesados?".

Diferencias con la fase 1 que hay que resolver antes:
- **Coste por diagnóstico.** `/prospectar` corre con la suscripción en local. Una landing
  pública necesita API (búsqueda + modelo) por cada visita. Hay que poner precio por
  diagnóstico y tope diario.
- **Abuso.** Captcha o verificación del correo antes de generar; límite por IP y por
  negocio. Un diagnóstico por negocio y semana.
- **Pago** del informe completo (Stripe) y su entrega.
- **El seguimiento a las 2 semanas solo vale aquí.** Para el correo frío sigue la regla
  del 25/09: un correo por negocio, para siempre.

## Lo físico sigue

En persona, el diagnóstico en papel sigue siendo lo primero y lo mejor para empezar. Es
la misma plantilla, impresa.

## Cómo funcionan las herramientas de leads (para mejorar el prospector)

Apollo, Hunter, Snov, Clay, Outscraper, Lusha… Todas combinan las mismas piezas. Cada
una es una mejora posible para `/prospectar` y, más adelante, algo que podríamos vender
como servicio.

| Pieza | Cómo lo hacen | Estado en `/prospectar` |
|---|---|---|
| **Censo de negocios** | Raspan Google Maps / Places y directorios del sector (Doctoralia, Treatwell, TheFork…) | ✅ se hace, a mano por pasada |
| **Rastreo de la web** | Recorren home, contacto, aviso legal y política de privacidad buscando `@` y `mailto:` | ✅ se hace (el aviso legal ya está en `PROSPECCION.md`) |
| **Desofuscación** | Decodifican el correo protegido de Cloudflare (`data-cfemail`, XOR con el primer byte) y los `[at]` / `(arroba)` | ❌ costó 2 leads en estética Valencia |
| **Adivinar por patrón** | Prueban `nombre@`, `n.apellido@`, `info@`… con el nombre del dueño | ❌ no se hace, y no conviene: un correo que no publicaron es peor para la LSSI |
| **Verificación SMTP** | Abren conexión con el MX, mandan `RCPT TO` sin enviar nada y miran si el servidor acepta la dirección; detectan dominios *catch-all* | ❌ **la mejora más barata**: evita rebotes, que son lo que más daña la reputación |
| **MX / DNS** | Comprueban que el dominio resuelve y tiene MX antes de nada | ❌ habría evitado los dos dominios muertos de estética Valencia |
| **Enriquecimiento** | Cruzan con LinkedIn y registros mercantiles para sacar dueño, cargo y tamaño | ❌ opcional; da nombre propio al saludo |
| **Señales de compra** | Ofertas de empleo ("buscamos recepcionista"), reseñas recientes que se quejan del teléfono, web nueva | parcial: las reseñas sí, el empleo no |
| **Deduplicación** | Por dominio, teléfono y nombre normalizado | ✅ desde el 25/09 |
| **Base agregada** | Guardan todo lo raspado y lo revenden | ❌ no queremos: es lo que más riesgo legal tiene |

**Orden de prioridad para incorporar:** MX/DNS → verificación SMTP → desofuscación de
Cloudflare → señales de empleo → enriquecimiento. Las tres primeras son código pequeño
dentro del importador (`scripts/import-outreach.mjs`) o como paso previo de la skill.
Ojo: muchas redes bloquean la salida por el puerto 25, y la verificación SMTP la necesita.
Probarlo en la máquina donde corra.
