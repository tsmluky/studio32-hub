---
name: studio32-lead-prospector
description: Encuentra, analiza y prioriza negocios físicos/locales como potenciales clientes para Studio32, y genera mensajes de outreach personalizados. Úsala SIEMPRE que el usuario quiera buscar leads, prospectar negocios locales, analizar la presencia digital de un sector/zona, evaluar una lista de negocios como posibles clientes, encontrar oportunidades comerciales para Studio32, auditar competencia local, o generar mensajes de contacto en frío para negocios. Triggers típicos - "busca [sector] en [zona]", "dame leads", "prospecta", "encuentra negocios para Studio32", "analiza estos negocios", "qué negocios podrían ser clientes", "leads para outreach", "negocios con mala presencia digital", "oportunidades comerciales en [ciudad]", "auditar competencia local". Funciona en dos modos auto-detectados - búsqueda activa (sector+zona) o análisis de leads proporcionados (lista/URLs).
---

# Studio32 Lead Prospector

Skill operativa para detectar y cualificar potenciales clientes de **Studio32 · Digital Systems**: negocios físicos/locales que pueden necesitar web premium, automatización, reservas, WhatsApp business, chatbot, o rebranding digital ligero.

**No es un buscador genérico de "malas webs".** Busca la intersección:

> Negocio con valor comercial + presencia digital mejorable + argumento de venta claro + capacidad probable de pago

---

## Modo de operación (auto-detección)

Antes de hacer nada, identifica el modo según el input:

| Señal en el input | Modo |
|---|---|
| Sector + ubicación, "busca", "encuentra", "dame N leads" | **A — Búsqueda activa** |
| Lista de nombres, URLs, CSV, capturas, "analiza estos" | **B — Análisis de leads dados** |
| Híbrido (lista + "complétame con más") | **A+B combinado** |
| "tanda para el hub", "sube leads", "prepara correos para Juanma" | **C — Tanda para el hub** |

Si el input es ambiguo, pregunta **una sola** cosa concreta (sector o ubicación, no ambas) y arranca.

### Defaults razonables (no preguntes por esto)

- Cantidad: 10 leads
- Idioma: español
- Objetivo: detectar oportunidad digital concreta + generar outreach
- Output: tabla priorizada + Top 3 detallado + mensajes en 3 longitudes por canal

---

## Modo A — Búsqueda activa

### Herramientas en orden de prioridad

1. **`places_search`** — fuente principal. Encuentra negocios reales del sector en la zona con datos verificables (rating, reseñas, web, dirección, fotos, horario). Es lo que da credibilidad al output: estás trabajando con negocios que existen y tienen ficha pública.
2. **`web_search`** — para complementar: encontrar webs específicas, redes sociales, prensa local, competencia.
3. **`web_fetch`** — para inspeccionar webs concretas detectadas como leads y juzgar su calidad real (no asumas que una web "se ve mal" sin haberla cargado).
4. **`image_search`** — opcional, si necesitas referencia visual del negocio.

### Workflow

1. **Descompón la búsqueda en queries**. Para "hamburgueserías premium en Valencia", no hagas una sola query genérica. Lanza varias en paralelo vía `places_search`:
   - "hamburgueserías Valencia centro"
   - "smash burger Valencia"
   - "hamburgueserías gourmet Valencia"

2. **Filtra por encaje con Studio32**. Descarta:
   - Cadenas grandes (McDonald's, KFC, franquicias internacionales)
   - Negocios con <20 reseñas (poca tracción / probable que no inviertan)
   - Negocios sin local físico claro
   - Negocios con valoración <3.8 (problemas operativos, no digitales)

3. **Para los candidatos restantes, verifica presencia digital**:
   - ¿Tiene web? → `web_fetch` para evaluarla
   - ¿Solo Instagram/Maps? → señal de oportunidad
   - ¿Web obsoleta, no mobile, sin CTA, sin reservas? → señal fuerte
   - Importante: **carga la web antes de juzgarla**. No inventes problemas.

4. **Aplica scoring con rúbrica explícita** (ver `references/scoring-rubric.md`).

5. **Genera el output** según la plantilla (ver `references/output-template.md`).

### Anti-fabricación

**Regla dura:** si no puedes verificar un dato, márcalo `No verificado` o `No encontrado`. Nunca inventes:

- URLs de web (especialmente esto — Claude tiene tendencia a inventar dominios plausibles)
- Handles de Instagram
- Número de reseñas
- Teléfonos o emails de contacto

Si el negocio no tiene web detectable en `places_search` ni en `web_search`, dilo: "Web: no encontrada". Eso **es información valiosa** — significa oportunidad clara para Studio32.

---

## Modo B — Análisis de leads dados

El usuario pasa una lista (texto plano, CSV, capturas, nombres sueltos).

### Workflow

1. **Estructura los inputs**. Extrae: nombre, web (si la dan), redes (si las dan), ciudad.
2. **Completa datos faltantes** vía `places_search` (busca cada negocio por nombre + ciudad) y `web_fetch` si hay URL.
3. **No descartes leads** que el usuario ha pasado expresamente, aunque parezcan no encajar. Si crees que no encajan, díselo en el análisis con argumento — pero analízalos igual.
4. Aplica scoring + output igual que Modo A.

---

## Modo C — Tanda para el hub

El output no es un informe para leer en chat: es un lote de leads que suben a la bandeja de aprobación del Hub, donde Juanma o Gonzalo leen el porqué, ven el correo redactado y aprueban o rechazan.

Cambia el destinatario, y eso cambia tres cosas.

### 1. La huella es obligatoria, y tiene esta forma

Por cada lead, una huella con estas cuatro partes. **No uses `references/huella.schema.json`
en este modo**: ese esquema es de otra ruta y el importador no lo lee.

- **`detalle_ancla`** — el detalle concreto y verificable que justifica escribirles a
  ELLOS. Es lo que hace que el correo no sirva para ningún otro negocio.
- **`voz_del_cliente`** — qué elogian siempre y qué falla siempre, con **cita literal y
  autor** de cada patrón. Sale de leer reseñas de verdad, no de suponer.
- **`huecos_digitales`** — qué le falta: sin WhatsApp, sin reserva online, web sin móvil.
- **`confianza`** — `alto` / `medio` / `bajo`, y qué no se pudo verificar.

### 2. La puerta se aplica antes de generar el archivo

Un lead **no entra en el JSON** si le falta cualquiera de estas:

- `email` — sin dirección pública no hay correo que aprobar
- `detalle_ancla` con fuente real — sin esto el correo es plantilla
- Al menos un elogio recurrente **con cita literal** — es de donde sale el tono
- Coherencia: si `confianza.nivel` es `bajo`, dilo, no lo maquilles
- Una fricción **que hayas visto tú** en el camino a pedir cita (reserva que no se cierra
  al momento, formulario, solo teléfono…), con su fuente. Si no hay ninguna concreta y
  observada, no se inventa una: el lead no sube
- La frase que conecta el problema con la `oferta` de la campaña — sin ella el correo
  diagnostica y no vende nada (ver punto 3)
- Un solo tratamiento, vosotros de principio a fin — revísalo al terminar, no solo al
  escribir (ver punto 3)

Los descartados se reportan aparte con su motivo en una línea. Son información sobre el
criterio de búsqueda, no basura.

**Prefiere 6 leads sólidos a 20 con relleno.** En cuanto la bandeja tenga ruido, dejará
de abrirse, y ahí se acaba la herramienta.

### 3. El correo, y qué no puede decir

Se redacta en primera persona (yo) hacia la clínica (vosotros). **Empieza directamente
por lo que has visto del negocio y termina en "Un saludo y gracias por vuestro tiempo,"
sin nombre.**

La presentación ("Hola, soy Juanma, de Studio32.") y la firma las compone el envío a
partir del remitente del mensaje. Es así porque en el Hub quien aprueba se queda el
cliente y el remitente cambia en ese momento: si el nombre viniera en el cuerpo, saldría
un correo que se presenta como quien no es. **No escribas saludo, ni nombre, ni el
estudio, ni la web.**

**La estructura, pauta del 02/10/2026** (sustituye a la del 15/09, ampliada el 24/09):
**evidencia → fricción → solución → pregunta.** Cuatro partes, cuatro párrafos y la
despedida. Una personalización, una fricción, una solución y una pregunta: se investiga
mucho y se escribe poco, y lo que sobre se queda en la huella. Las reglas completas, la
jerarquía de evidencias y los ejemplos están en `references/outreach-guidelines.md`; léelo
antes de redactar.

1. **Personalización: UNA evidencia** — el detalle ancla, o el elogio, que más
   difícilmente valdría para otra clínica: una reseña llamativa, un tratamiento concreto que
   citan, miembros del equipo nombrados, una especialización, que el doctor forma a otros
   profesionales, tecnología, trayectoria, nº y nota de reseñas (aproximadamente en ese
   orden). Concreta y comprobable, 1-2 frases, con su dato. "Me gusta el enfoque cercano"
   **no vale**: lo dice la web de casi cualquier clínica. Y no una lista de todo lo
   encontrado: una sola.
2. **Fricción: UNA, la que tú has visto** — contada desde lo que encuentra el paciente al
   pedir cita ("Sin embargo, al pedir cita, encuentra teléfono, WhatsApp y correo, pero no
   una forma de dejar la cita cerrada en ese momento"). Prioridad: reserva que no se puede
   cerrar al momento, necesidad de una persona para saber la disponibilidad, nada fuera de
   horario, demasiados pasos, formulario sin respuesta inmediata. **Observación, no
   suposición**: se cuenta lo que se ve, nunca cómo trabajan por dentro ("seguro que hay
   mensajes que tardan", "estáis perdiendo pacientes", "la recepción está saturada"). Si no
   sabes si el WhatsApp contesta solo, no digas que no lo hace: di que no aparece una forma
   de consultar la disponibilidad y dejar la cita cerrada. El correo tiene que seguir siendo
   razonable aunque ya lo lleven bien por dentro, y nunca critica su web ni su sistema.
3. **Solución — la frase de oferta**, en primera persona y ligada a ESA fricción: "Es justo
   lo que montamos: …". Se dice solo lo que responde a la fricción (agenda real y cita
   cerrada; respuesta a cualquier hora; conversación por WhatsApp sin pasos; preguntas
   frecuentes, disponibilidad y recordatorio) y nunca la lista de funciones. Sin técnica
   (API, webhook, LLM) y sin "IA" como argumento. Empieza por "Es justo lo que montamos en
   Studio32:". Ver abajo.
4. **Pregunta, en su propio párrafo** — una sola, de sí o no: "¿Os enseño cómo funcionaría
   aplicado a vuestra clínica?" (o "vuestro centro"; también "¿Os enseño cómo quedaría en
   vuestro caso?"). Ni "podéis escribirme" (les deja el trabajo a ellos), ni "3 mejoras
   concretas", ni reunión, llamada o demo.

**Un solo producto.** Desde el 02/10 ya no hay frase de "otros servicios": no se menciona
ninguna web, SEO, ficha de Google, correo con dominio ni marketing. Se enseñan cuando
contestan. Si la `oferta` de la campaña es una web, esa web es el único producto y la
fricción tiene que ser la que esa web arregla; la estructura es la misma. **100-140
palabras** sin la despedida (se admite de 80 a 160).

**La tipografía, de persona** (24/09/2026): comillas rectas " " para citar, nunca « » ni
“ ”; tres puntos y no el carácter …; y ninguna raya (— o –) en el correo, ni en el asunto:
coma, dos puntos o punto. Son lo primero que delata un texto generado. `outreach-send`
revisa cada correo antes de enviarlo (`supabase/functions/_shared/reglas-correo.js`) y
para el que no cumpla.

**El asunto**: corto y llano, sin parecer campaña — "Sobre las citas de X", "Pedir cita en
X", "Las citas en X", "El WhatsApp de X", "Consulta sobre X", "Una idea para vuestra
clínica", "Una idea sobre vuestra agenda", "Una cosa que vi en vuestra web". Nunca
"Propuesta", "Oferta", promesas ni emojis. Tampoco el genérico "Os escribimos de Studio32",
que no dice de qué va.

**Lo que el agente NO hace y por tanto no se ofrece nunca:** atender llamadas de
teléfono. Es solo WhatsApp. **Tampoco se habla de "un ejemplo real" ni de "clínicas
como la vuestra"**: no hay ningún cliente todavía, y lo que se enseña es una clínica de
prueba. Sí se puede ofrecer: responder y dar cita al momento sobre la agenda real, y
mandar un recordatorio antes de la cita.

**Las quejas de sus clientes NUNCA se citan al prospecto.** Van en la huella porque
explican el lead y sirven para una llamada, pero echárselas en cara lo pierde. El correo
se apoya en el detalle ancla y en las palabras que usan sus propios clientes.

Cada afirmación del cuerpo tiene que poder acompañarse de su cita en `evidencia`. Si no
puedes citarla, no la escribas.

**La `oferta` de la campaña tiene que aparecer en el cuerpo, y en una frase propia — no
al final de la puerta como checklist.** Un correo que solo diagnostica ("son cinco
reglas que el paciente tiene que acertar", "esas 24 horas en la práctica son cuatro
días") y nunca dice con qué se resuelve deja la decisión en manos del prospecto, que es
justo el trabajo que le corresponde al correo. La frase va **después** del párrafo que
señala el problema y **antes** del cierre de baja fricción, y traduce la `oferta` al
caso concreto del lead — no la pega genérica de qué es un asistente de WhatsApp.

**Y tiene que decir que eso lo montáis vosotros.** Hasta el 15/09 la frase era
impersonal ("Un agente de WhatsApp con vuestra agenda delante podría…"): se leía como un
consejo, no como algo que se ofrece, y el prospecto terminaba el correo sin que nadie le
dijera quién lo hace. Ejemplo (Gnadent, el cupo de 20 pacientes repartido a mano):

> Es justo lo que montamos: un asistente de WhatsApp con vuestra agenda real delante que
> reparte ese cupo solo, a cualquier hora, incluido el domingo por la noche, sin que
> nadie tenga que estar pendiente del teléfono.

**No repitas la misma frase en todos los correos.** Si diez borradores de la tanda dicen
"Un agente de WhatsApp con vuestra agenda real delante podría dar esa cita a cualquier
hora", se nota la plantilla aunque el resto sea único. Lo mismo con el arranque: no
empieces todos por "Vi…".

Correo completo de referencia (lo que escribe la skill; la presentación y la firma no):

> Tres de las reseñas que tenéis en Google nombran a Lucía por cómo explica cada ejercicio,
> y una paciente cuenta que salió de la primera sesión sabiendo exactamente qué tenía que
> hacer en casa. Se ve que ese cuidado en explicar es una seña de la casa.
>
> Sin embargo, el botón de pedir cita de la web termina en un formulario de contacto, no en
> una agenda donde elegir hora.
>
> Es justo lo que montamos en Studio32: un asistente en vuestro WhatsApp que habla con el paciente,
> mira la agenda real y le deja la cita cerrada ahí mismo, sin formulario de por medio.
>
> ¿Os enseño cómo quedaría en vuestro caso?
>
> Un saludo y gracias por vuestro tiempo,
>
> (Negocio ficticio. Una personalización, una fricción, una solución y una pregunta; sin
> otros servicios.)

Un lead sin esa frase **no sube en modo C**: aplica igual que la puerta del punto 2.

**Un solo tratamiento por correo — "vosotros" o "tú", nunca los dos.** El correo se
dirige a la clínica o el centro, no a una persona ("Os encontré...", "vuestra web...",
"estáis cerrados..."): usa **vosotros** de principio a fin, cierre incluido. Es un fallo
frecuente porque el cierre de baja fricción a veces se redacta aparte del resto del
cuerpo — "Si **os** interesa, **os** mando..." nunca "Si **te** interesa, **te** paso...".
Una cita literal de la propia web o reseña del negocio puede contener "tú" o "tus" sin
que cuente como mezcla (es su voz, no la del correo); lo que no puede pasar es que la
voz de quien escribe cambie de tratamiento a media carta.

Sigue aplicando `references/outreach-guidelines.md`: nada de emojis, promesas numéricas,
"espero que estés bien" ni lenguaje de agencia. El test es que el correo sea
**inservible para cualquier otro negocio**.

### 4. Qué entrega el modo C

**Un único archivo JSON con la forma exacta que espera `npm run outreach --`.** No
es negociable: el importador no adivina, y un archivo con otra forma se rechaza o entra
a medias.

```json
{
  "campaign": {
    "name": "Clínicas dentales · Alcalá de Henares",
    "sector": "Clínicas dentales",
    "city": "Alcalá de Henares",
    "oferta": "Asistente de WhatsApp que atiende y da cita",
    "from_email": "Juanma · Studio32 <juanma@studio32.es>",
    "reply_to": "juanma@studio32.es"
  },
  "leads": [
    {
      "business_name": "Nombre real de la clínica",
      "address": "Calle y número",
      "postal_code": "28801",
      "website": "https://...",
      "email": "contacto@...",
      "phone": "918 00 00 00",
      "maps_url": "https://maps.google.com/...",
      "score": 84,
      "digital_level": "bajo",
      "has_whatsapp": false,
      "has_online_booking": false,
      "rating": 4.7,
      "reviews": 240,
      "problems": ["Sin WhatsApp", "Sin reserva online"],
      "owner_member_id": "juanma",
      "huella": {
        "detalle_ancla": {
          "detalle": "El detalle concreto y verificable que justifica escribirles",
          "por_que_importa": "Por qué abre la conversación",
          "fuente": "De dónde sale"
        },
        "voz_del_cliente": {
          "elogios_recurrentes": [
            { "patron": "Qué elogian siempre", "cita": "Cita literal", "fuente": "Autor · Google", "veces": 7 }
          ],
          "quejas_recurrentes": [
            { "patron": "Qué falla siempre", "cita": "Cita literal", "fuente": "Autor · Google", "veces": 3 }
          ],
          "palabras_que_usan": ["cómo llaman ellos a lo que compran"]
        },
        "huecos_digitales": ["Sin WhatsApp", "Sin reserva online"],
        "confianza": { "nivel": "alto", "no_encontrado": ["Lo que no se pudo verificar"] }
      },
      "message": {
        "subject": "Asunto corto y llano con el nombre del negocio: Pedir cita en X",
        "body": "100-140 palabras: personalizacion, friccion, solucion, pregunta. Sin saludo ni presentacion (los pone el envio). Termina en \"Un saludo y gracias por vuestro tiempo,\" SIN nombre.",
        "evidencia": [
          { "rol": "personalizacion", "afirmacion": "La frase del correo que afirma algo del negocio", "cita": "La cita que la sostiene", "fuente": "Autor · Google", "confianza": 0.95 },
          { "rol": "friccion", "afirmacion": "Lo que se ve al pedir cita", "cita": "Lo que dice la web o la página de contacto", "fuente": "Web · página de contacto", "confianza": 0.9, "angulo": "cita cerrada desde WhatsApp" }
        ]
      }
    }
  ]
}
```

**`campaign.name` importa:** si coincide con una campaña que ya existe, los leads se
enganchan a ella y pasa de `pedida` a `abierta`. Cuando el encargo venga de
`npm run outreach`, usa el nombre tal cual lo da.

**`from_email` tiene que ser un alias que exista de verdad:** `info`, `citas`,
`contacto`, `francisco`, `gonzalo`, `hello`, `juanma`, `kikos`, `support`.
**No existe `hola@`.** Pancho firma como `francisco@`.

**`evidencia` es lo que hace revisable el correo.** Cada afirmación del cuerpo con su
cita literal y su fuente. Es lo que se enseña en el Hub debajo del correo para que quien
aprueba lo compruebe en dos segundos en vez de fiarse.

**Y desde el 02/10 dice por qué se escribió ese correo.** Los dos elementos que lo sostienen
llevan `rol`: `personalizacion` (la evidencia elegida) y `friccion` (lo que se vio al pedir
cita, con `angulo`, la capacidad del asistente que le responde: "reserva directa desde
WhatsApp"). Los dos llevan `confianza` de 0 a 1, lo seguro que estás de haberlo verificado.
**Por debajo de 0,8 no es un hecho: reformúlalo como lo que sí se ve, o no lo uses.** Es el
registro que permite auditar el correo, detectar una alucinación y regenerarlo. El Hub ya lo
guarda (la columna es jsonb) pero todavía no lo enseña.

**Las quejas nunca se citan en el correo.** Van en la huella porque explican el lead y
sirven para una llamada, pero echárselas en cara al prospecto lo pierde.

### 5. Cómo se sube

```
npm run outreach -- <archivo.json>
```

**Escribe en cuanto se lanza: no hay modo de revisión.** Lo que suba entra como borrador
y nadie lo recibe sin que se apruebe en el Hub, pero un lead flojo que llegue a la
bandeja ya ha gastado la confianza de quien la abre.

---

## Scoring (con rúbrica obligatoria)

Dos puntuaciones independientes, 0-100 cada una:

- **Digital Presence Score** → calidad actual de la presencia digital. Bajo = peor presencia.
- **Studio32 Opportunity Score** → atractivo como lead. Alto = mejor lead.

**Regla crítica:** cada score que pongas en la tabla debe poder justificarse con la rúbrica de `references/scoring-rubric.md`. Si no puedes desglosar de dónde sale el número, **no muestres el número**. Pon "N/D" o usa banda cualitativa ("baja / media / alta"). El humo cuantitativo es peor que admitir desconocimiento.

Para el **Top 3 detallado**, desglosa el scoring por factores (no es opcional).

Lee `references/scoring-rubric.md` antes de puntuar.

---

## Outreach (3 longitudes por canal)

Para cada lead del Top 3, genera mensajes en estos formatos:

| Canal | Longitud objetivo |
|---|---|
| WhatsApp / DM Instagram — **corto** | 2-3 líneas, 40-60 palabras |
| Email frío — **medio** | 100-140 palabras, asunto + cuerpo |
| Visita presencial / llamada — **guion** | 4-6 frases, hablado |

**Reglas de redacción** (ver `references/outreach-guidelines.md` para detalle completo):

- Tono Studio32: sobrio, directo, consultivo. Sin frases motivacionales, sin "transformamos tu negocio", sin emojis salvo el canal lo pida.
- **Cada mensaje cita un problema concreto detectado en ESE negocio.** Si no hay problema concreto identificable, no generes mensaje — es señal de que el lead no es prioritario.
- Nunca decir "tu web es mala". Reformular como "tu local transmite X pero la web no acompaña" / "tienes Y reseñas pero la conversión digital está infrautilizada".
- Cierre suave: ofrecer mini auditoría o 3 mejoras concretas, no pedir reunión directamente.
- No prometer resultados numéricos ("+30% clientes"). Sí mencionar palancas ("reservas online", "captación desde Google", "mejor primera impresión").
- Firma como Francisco (o Juanma si el usuario lo indica) — Studio32.

Para leads que **no entran en Top 3** pero quedan en la tabla: incluye solo una columna "Gancho de mensaje" — frase de una línea que resume el ángulo de approach, no el mensaje completo. Generar 10 mensajes completos cuando 7 son leads medios es desperdiciar atención.

---

## Sectores prioritarios para Studio32

Encaje fuerte:
- Restaurantes premium, hamburgueserías urbanas, cafeterías de especialidad
- Clínicas dentales, centros de estética, fisioterapia
- Gimnasios boutique, estudios de pilates/yoga
- Estudios de arquitectura, interiorismo
- Inmobiliarias locales (no grandes cadenas)
- Peluquerías/barberías premium
- Hoteles boutique, casas rurales premium
- Academias privadas, formación especializada
- Servicios profesionales locales (abogados, asesorías de nicho)

Encaje débil (avisa al usuario si pide prospectar aquí):
- Comercio retail puro (zapaterías, papelerías) — margen bajo, poca palanca digital
- Servicios B2B grandes — no es el ICP de Studio32
- Negocios <20 reseñas o sin presencia mínima — probable que no inviertan

---

## Output: estructura final

Sigue **siempre** este orden, sin desviarte:

1. **Resumen ejecutivo** (4-6 líneas)
2. **Tabla de leads priorizados** (ordenada por Opportunity Score descendente)
3. **Top 3 oportunidades detalladas** (con desglose de scoring + mensajes en 3 longitudes)
4. **Leads descartados** (si aplica, con razón en 1 línea — útil para que el usuario aprenda el criterio)
5. **Próximos pasos recomendados** (3-5 acciones concretas)

Plantilla completa en `references/output-template.md`.

### Formato

Por defecto: Markdown en chat.

Si el usuario pide export, ofrece:
- **CSV** (para CRM / hoja de cálculo)
- **JSON** (para integraciones)
- **HTML auditoría** (para enviar al lead — solo cuando el usuario lo solicite explícitamente para un lead concreto, no como output masivo)

---

## Lo que esta skill NO hace

- **No contacta** automáticamente a ningún negocio. Genera drafts, el usuario decide.
- **No hace scraping agresivo** ni intenta saltarse restricciones (Instagram privado, etc.).
- **No inventa datos.** Si falta info, lo dice.
- **No genera 50 leads superficiales.** Mejor 10 bien analizados.
- **No critica negocios destructivamente.** Reformula como oportunidad.
- **No promete resultados** ("vas a conseguir 100 clientes"). Habla de palancas.

---

## Archivos de referencia

Cárgalos cuando los necesites, no por defecto:

- `references/huella.md` — el retrato verificable del negocio y su esquema. **Léelo antes de analizar cualquier lead**, y siempre en Modo C.
- `references/huella.schema.json` — esquema formal de la huella.
- `references/scoring-rubric.md` — desglose factor por factor de los dos scores. **Léelo antes de puntuar.**
- `references/outreach-guidelines.md` — reglas de tono Studio32, ejemplos buenos/malos, plantillas por canal. **Léelo antes de redactar mensajes.**
- `references/output-template.md` — plantilla Markdown completa con todos los bloques. **Léelo cuando vayas a generar el output final.**
- `references/sector-playbooks.md` — argumentos comerciales específicos por sector (hostelería, salud, inmobiliario, etc.). **Léelo cuando el sector esté en la lista.**
