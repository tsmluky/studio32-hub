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

Los descartados se reportan aparte con su motivo en una línea. Son información sobre el
criterio de búsqueda, no basura.

**Prefiere 6 leads sólidos a 20 con relleno.** En cuanto la bandeja tenga ruido, dejará
de abrirse, y ahí se acaba la herramienta.

### 3. El correo, y qué no puede decir

Se redacta en la voz del remitente de la campaña y **termina con su firma** (ver el
formato abajo): nada la compone en el envío, así que un cuerpo sin firma sale sin firma.

**Las quejas de sus clientes NUNCA se citan al prospecto.** Van en la huella porque
explican el lead y sirven para una llamada, pero echárselas en cara lo pierde. El correo
se apoya en el detalle ancla y en las palabras que usan sus propios clientes.

Cada afirmación del cuerpo tiene que poder acompañarse de su cita en `evidencia`. Si no
puedes citarla, no la escribas.

Sigue aplicando `references/outreach-guidelines.md`: nada de emojis, promesas numéricas,
"espero que estés bien" ni lenguaje de agencia. El test es que el correo sea
**inservible para cualquier otro negocio**.

### 4. Qué entrega el modo C

**Un único archivo JSON con la forma exacta que espera `npm run outreach:import`.** No
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
        "subject": "Asunto de 4-7 palabras, concreto",
        "body": "80-120 palabras. Termina CON FIRMA.",
        "evidencia": [
          { "afirmacion": "La frase del correo que afirma algo", "cita": "La cita que la sostiene", "fuente": "Autor · Google" }
        ]
      }
    }
  ]
}
```

**`campaign.name` importa:** si coincide con una campaña que ya existe, los leads se
enganchan a ella y pasa de `pedida` a `abierta`. Cuando el encargo venga de
`npm run outreach:pendientes`, usa el nombre tal cual lo da.

**`from_email` tiene que ser un alias que exista de verdad:** `info`, `citas`,
`contacto`, `francisco`, `gonzalo`, `hello`, `juanma`, `kikos`, `support`.
**No existe `hola@`.** Pancho firma como `francisco@`.

**`evidencia` es lo que hace revisable el correo.** Cada afirmación del cuerpo con su
cita literal y su fuente. Es lo que se enseña en el Hub debajo del correo para que quien
aprueba lo compruebe en dos segundos en vez de fiarse.

**Las quejas nunca se citan en el correo.** Van en la huella porque explican el lead y
sirven para una llamada, pero echárselas en cara al prospecto lo pierde.

### 5. Cómo se sube

```
npm run outreach:import -- <archivo.json>
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
| Email frío — **medio** | 80-120 palabras, asunto + cuerpo |
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
