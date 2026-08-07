# La huella — retrato mínimo y verificable de un negocio

Esquema formal: `huella.schema.json` (mismo directorio). Este documento explica **por qué** tiene esa forma y **cómo** rellenarla.

---

## Para qué sirve

La huella se mina una vez y se usa dos veces:

1. **Captación** — es lo que permite escribir un correo que solo sirve para *ese* negocio, y es lo que Juanma lee para decidir si lo aprueba.
2. **Configuración del tenant** — si el lead convierte en cliente, la huella es el arranque de su bot en `studio32-agent`. El trabajo de prospección no se tira.

Esa doble vida es lo que justifica hacerla bien. Si solo sirviera para escribir un correo, bastaría con cuatro notas sueltas.

---

## El modelo de dos capas

| Capa | Qué es | Dónde vive | Quién la escribe |
|---|---|---|---|
| **Arquetipo** | El alma del oficio: cómo llega la gente, qué teme, qué prioriza. El 90% | `studio32-agent/templates/<vertical>/` | Nosotros, una vez por vertical |
| **Huella** | Lo poco que distingue a ESTE negocio | Este esquema | Se mina, no se pregunta |

**La huella no se le pregunta al dueño.** Un dueño no sabe describir el alma de su negocio — dirá "trato cercano y calidad" como todos. Pero sus clientes ya la describieron, gratis y sin filtro, en las reseñas de Google.

Que dos negocios del mismo vertical acaben pareciéndose no es un problema: cada bot compite con la competencia local, no con el otro.

---

## La regla que sostiene todo: evidencia o silencio

Todo campo interpretativo es una **observación**, y una observación no existe sin evidencia:

```json
{
  "valor": "Se posicionan por trato familiar, no por precio",
  "evidencia": "14 de 30 reseñas leídas mencionan a 'Marta' por su nombre; la web abre con 'llevamos 22 años en el barrio'",
  "fuente": "resenas",
  "confianza": "alta"
}
```

### Niveles de confianza

| Nivel | Qué significa | Puede citarse en el correo |
|---|---|---|
| **alta** | Dato literal de una fuente que cargaste | Sí, incluso literalmente |
| **media** | Inferencia razonable a partir de fuente cargada | Sí, pero con matiz ("parece que", "diría que") |
| **baja** | Conjetura | **No.** Sirve para orientarte, nunca para el texto |

Esta es la diferencia mecánica entre un correo útil y spam. No es una recomendación de estilo: es una puerta.

### Coherencia obligatoria con `verificacion`

- `web_cargada: false` → no puede existir ninguna observación con `fuente: "web"`
- `resenas_leidas: 0` → no puede existir ninguna observación con `fuente: "resenas"`
- `competencia_buscada: false` → no se menciona competencia en el correo, ni de pasada

Si te saltas esto, el score y el correo son humo, y Juanma lo va a notar a la tercera tarjeta.

---

## La puerta: cuándo un lead NO sube al hub

Un lead se descarta antes de llegar a la bandeja si:

- No hay **ningún dolor** con confianza `alta` o `media`
- No hay **ningún ángulo** redactable en una frase
- No hay **email de contacto público** (sin eso no hay correo que aprobar)
- `verificacion` no respalda lo que afirma la huella

Es preferible que Juanma vea 6 leads sólidos que 20 donde 14 son relleno. En cuanto la bandeja tenga ruido, dejará de abrirla — y ahí se acaba la herramienta.

Los descartados se registran con su motivo. Es información: enseña dónde falla el criterio de búsqueda.

---

## Cómo se mina, en orden

1. **`places_search`** — hechos duros: nombre, dirección, web, teléfono, reseñas. Nada de esto se estima.
2. **Reseñas** — la parte más valiosa. Lee al menos 15-20 y anota **literales**, no resúmenes. Busca: qué palabra se repite, a quién nombran por su nombre, qué agradecen, de qué se quejan.
3. **`web_fetch`** de la web, si existe — cómo se describen, si hay lema, ticket, si se puede reservar. Si no la cargas, dilo y no opines sobre ella.
4. **Instagram**, si es su canal principal — ritmo de publicación y coherencia de marca.
5. **Competencia**, solo si vas a usarla — dos o tres del mismo sector y zona.

### Errores que hay que evitar

- **Inventar dominios.** Es la tentación más fuerte y la más destructiva. Si no aparece web, la web es `null`, y eso *es* el hallazgo.
- **Resumir reseñas en vez de citarlas.** "Buenas reseñas" no vale nada. "Siete personas mencionan que Marta les explicó el presupuesto sin prisa" vale muchísimo.
- **Rellenar `lo_que_ya_funciona` con genéricos.** Ese campo existe para no proponerles algo que ya tienen. Si va vacío, va vacío.

---

## Qué se hereda si el lead convierte

Cuando un lead firma, esto es lo que pasa a `studio32-agent`:

| Campo de la huella | Dónde aterriza | Para qué |
|---|---|---|
| `negocio.vertical` | Elige `templates/<vertical>/` | Selecciona el arquetipo de partida |
| `negocio.ciudad` | `business.json → ciudad` | Directo |
| `identidad.lema_o_promesa` | `tone.md` | El arquetipo ya pide "si tiene un lema, hazlo tuyo" |
| `voz.como_les_hablan_sus_clientes` | `tone.md` | Ajusta el registro al que ya funciona con su gente |
| `voz.palabras_de_clientes` | `tone.md` | Léxico real del negocio, no el nuestro |
| `lo_que_ya_funciona` | `tone.md` — sección "lo que te hace brillar" | Lo que el bot debe proteger, no reinventar |
| `identidad.que_venden` | `services.json` | Punto de partida para el catálogo |

`vertical: "otro"` significa que aún no hay arquetipo. El lead sigue siendo válido para captación, pero la herencia no es automática: habría que escribir el arquetipo de esa vertical primero.

---

## Ejemplo abreviado

```json
{
  "version": "1",
  "negocio": {
    "nombre": "Clínica Dental Ejemplo",
    "vertical": "clinica_dental",
    "ciudad": "Guadalajara",
    "web": null,
    "maps_url": "https://maps.google.com/?cid=...",
    "email": "info@ejemplo.es",
    "resenas": { "total": 143, "media": 4.7 }
  },
  "verificacion": {
    "web_cargada": false,
    "resenas_leidas": 22,
    "competencia_buscada": true,
    "notas": "No se encontró web propia tras places_search y web_search."
  },
  "identidad": {
    "como_se_describen": {
      "valor": "No hay descripción propia disponible: no tienen web ni texto en Maps",
      "evidencia": "Ficha de Maps sin descripción; búsqueda web sin resultado propio",
      "fuente": "google_maps",
      "confianza": "alta"
    },
    "que_venden": {
      "valor": "Odontología general con peso claro en ortodoncia infantil",
      "evidencia": "9 de 22 reseñas leídas hablan de brackets o revisiones de niños",
      "fuente": "resenas",
      "confianza": "alta"
    }
  },
  "voz": {
    "como_les_hablan_sus_clientes": {
      "valor": "Lo que agradecen es que les expliquen sin prisa y sin miedo, no la tecnología",
      "evidencia": "Repiten 'me lo explicó todo con calma' y 'no me sentí presionada'",
      "fuente": "resenas",
      "confianza": "alta"
    },
    "palabras_de_clientes": ["con calma", "sin presionar", "me lo explicó todo", "los niños salen contentos"]
  },
  "momento": {
    "fase": "consolidado",
    "evidencia": "143 reseñas acumuladas y menciones a 'llevo años viniendo' en 4 reseñas"
  },
  "lo_que_ya_funciona": [
    {
      "valor": "Reputación local muy fuerte y sostenida",
      "evidencia": "4.7 de media con 143 reseñas; las recientes mantienen el nivel",
      "fuente": "google_maps",
      "confianza": "alta"
    }
  ],
  "dolor": [
    {
      "dolor": "Toda la captación depende de Maps y del teléfono; no hay forma de pedir cita fuera de horario",
      "evidencia": "Sin web, sin reservas online, y 3 reseñas mencionan dificultad para que cojan el teléfono",
      "confianza": "alta"
    }
  ],
  "angulos": [
    {
      "angulo": "143 reseñas de gente que vuelve, y quien las lee no tiene dónde pedir cita",
      "apoyado_en": "Reputación alta verificada + ausencia total de canal de reserva"
    }
  ]
}
```

Fíjate en que el correo se escribe solo desde aquí, y que nada de lo que diría es genérico.
