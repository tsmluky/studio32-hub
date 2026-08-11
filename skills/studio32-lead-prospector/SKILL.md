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

### 1. La huella es obligatoria, no opcional

Lee `references/huella.md` y emite una huella completa y válida contra `references/huella.schema.json` por cada lead. Sin huella no hay lead.

### 2. La puerta se aplica antes de subir

Un lead **no sube** si le falta cualquiera de estas cuatro cosas:

- Al menos un `dolor` con confianza `alta` o `media`
- Al menos un `angulo` redactable en una frase
- `negocio.email` — sin dirección pública no hay correo que aprobar
- Coherencia entre `verificacion` y lo que afirma la huella

Los descartados se reportan aparte con su motivo en una línea. Son información sobre el criterio de búsqueda, no basura.

**Prefiere 6 leads sólidos a 20 con relleno.** En cuanto la bandeja tenga ruido, dejará de abrirse, y ahí se acaba la herramienta.

### 3. El correo se escribe para un remitente concreto

Cada lead lleva un `sender_id` (`juanma`, `gonzalo` o `pancho`). El correo se redacta **en la voz de esa persona** — no genérico para asignárselo a alguien después.

**Pero el cuerpo NO lleva firma.** El cierre ("Un saludo,") sí es parte de la voz y se escribe. El bloque de nombre, estudio y web se añade solo en el envío, desde `src/remitentes.json`, según el `sender_id` que tenga el lead en ese momento.

Es así porque en el hub quien aprueba puede quedarse el envío: si Gonzalo aprueba un correo que subió a nombre de Juanma, pulsa "lo envío yo" y el remitente cambia. Si la firma viniera dentro del texto, saldría un correo firmado por quien no es. El `sender_id` que subes es una **sugerencia razonada**, no una asignación definitiva.

El script de subida rechaza los cuerpos que traen firma incrustada.

Solo se puede citar material de confianza `alta` o `media`. Lo de confianza `baja` orienta el ángulo, pero no aparece en el texto.

Sigue aplicando `references/outreach-guidelines.md`: el test es que el correo sea **inservible para cualquier otro negocio**.

### 4. Qué entrega el modo C

Por cada lead que pasa la puerta:

| Campo | Contenido |
|---|---|
| `huella` | JSON válido contra el esquema |
| `porque` | 3-5 líneas: por qué este negocio y por qué ahora. **Es lo que Juanma lee primero** |
| `sender_id` | Quién lo firmaría (sugerencia; el hub puede cambiarlo) |
| `asunto` | 4-7 palabras, concreto. Nunca "Propuesta" ni "Colaboración" |
| `cuerpo` | 80-120 palabras, en la voz del remitente, **sin bloque de firma** |
| `scores` | Digital Presence y Opportunity, con desglose |

El `porque` no es un resumen del correo. Es el argumento para que un humano decida en quince segundos, y debe apoyarse en evidencia citable.

### 5. Formato de entrega

Un único archivo JSON con esta forma. Los datos del negocio **no se repiten**: se leen de `huella.negocio`.

```json
{
  "tanda": "2026-08-07-dentistas-guadalajara",
  "leads": [
    {
      "sender_id": "juanma",
      "porque": "...",
      "asunto": "...",
      "cuerpo": "...",
      "digital_score": 32,
      "opportunity_score": 84,
      "scores_desglose": { },
      "huella": { }
    }
  ]
}
```

Se sube con `npm run leads:subir -- <archivo.json>`, que revisa sin escribir nada y
vuelve a aplicar la puerta por su cuenta. Añadir `--confirmar` para subir de verdad.

El script bloquea, además, los antipatrones que `outreach-guidelines.md` marca como
"nunca": emojis, promesas numéricas, "espero que estés bien" y lenguaje de agencia.
No los avisa — los rechaza. Si un lead tuyo cae ahí, el correo estaba mal escrito.
También rechaza los cuerpos que traen firma: la firma la compone el envío.

Un negocio, un correo: el script deduplica por email y también por dominio propio,
así que `info@clinica.es` y `citas@clinica.es` no pueden recibir dos correos. Si un
lead se marcó como baja, rechazado o ya enviado, su negocio queda ocupado para
siempre — es justo lo que impide volver a escribirle.

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
