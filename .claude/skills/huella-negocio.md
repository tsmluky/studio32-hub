---
name: huella-negocio
description: "Extrae la huella de marca de un negocio a partir de su presencia pública: qué vende, cómo habla, qué dicen de él sus clientes y qué detalle concreto lo distingue. Produce un artefacto reutilizable que alimenta tanto la redacción de correos de prospección como el tono de un agente nuevo. Usa esta skill cuando el usuario quiera analizar la marca o la voz de un negocio, preparar el tono de un agente, entender cómo habla un negocio, sacar la personalidad de una marca, o preparar material para escribirle a un negocio sin que suene genérico. Triggers: 'saca la huella de', 'analiza la marca de', 'cómo habla este negocio', 'prepara el tono para', 'huella de marca', 'voz de cliente', 'qué dicen las reseñas de', 'perfil de marca', 'investiga este negocio para escribirle', 'prepara el tone.md de'."
---

# Huella de negocio

Le das un negocio y sacas su **huella**: qué vende de verdad, con qué palabras habla, qué
dicen sus clientes de él y un detalle concreto que demuestre que alguien ha mirado.

La huella tiene **dos consumidores** y se escribe una sola vez:

1. El **redactor de correos** de prospección, para que el mensaje hable de algo real de ese
   negocio y no haya que reescribirlo antes de enviarlo.
2. El **`tone.md` de un tenant nuevo** del agente, que es el 10% de huella que se monta
   encima del 90% de arquetipo por vertical.

**Regla fundamental: cada dato lleva su fuente y nada se inventa.** Si algo no se ha podido
verificar, se marca como no encontrado. Un correo que cita algo falso es peor que uno
genérico: quema al prospecto y a Studio32.

**Regla de método: se mina, no se entrevista.** El dueño de un negocio no sabe describir su
propia alma. Sus clientes sí lo hacen, y ya lo han escrito en las reseñas.

---

## Paso 1 — Recibir el negocio

La skill acepta dos entradas:

- **Un lead de prospección** — nombre, web, teléfono, Maps. Normalmente viene del JSON que
  produce la skill de prospección, o de una fila de `outreach_leads`.
- **Un negocio suelto** — el usuario da el nombre y, como mínimo, la web o la ficha de Maps.

Si te dan una lista, procesa de una en una y avisa del progreso. No hagas más de 8-10
seguidas sin preguntar si sigue: cada huella son varias peticiones de red.

Lo mínimo imprescindible es **la web o la ficha de Google**. Sin ninguna de las dos no hay
huella que sacar: dilo y pide una de las dos.

---

## Paso 2 — Reunir las fuentes

Por orden. Ninguna es obligatoria salvo la primera que exista.

**La web.** Con WebFetch, la home y —si existen— "sobre nosotros", servicios y el blog.
Es la fuente de cómo *quieren* sonar.

**Las reseñas de Google.** Es la fuente más valiosa y la que más cuesta. Búscalas con
WebSearch (`"[nombre]" "[ciudad]" opiniones` / `reseñas`) y, si hay Firecrawl o Playwright,
scrapea la ficha. Necesitas el **texto literal** de las reseñas, no solo la nota media.
Apunta a 15-30; con menos de 5 dilo claramente, porque la voz del cliente sale débil.

**Las redes.** Solo si la web enlaza a ellas. Interesa la bio, la frecuencia y el registro
de los pies de foto, no el número de seguidores.

**Directorios del sector.** Solo si la web no existe o está vacía.

Si una fuente falla, sigue con las demás y anótalo. No te bloquees ni instales nada pesado
para conseguir una sola fuente.

---

## Paso 3 — Leer la web: cómo quieren sonar

De los textos de la propia web, extrae:

- **Qué venden de verdad**, con sus nombres. Si llaman "primera valoración" a lo que otros
  llaman "consulta gratuita", el nombre de ellos es el que vale.
- **Registro**: ¿tratan de tú o de usted? ¿Frases largas o cortas? ¿Técnico o llano?
  ¿Hablan de sí mismos o del cliente?
- **Expresiones propias**: giros que repiten y que suenan suyos. Cítalos literales.
- **Muletillas de folleto**: "disponemos de", "amplia experiencia", "calidad y servicio",
  "los mejores profesionales". Anótalas: van a la lista negra.
- **Qué prometen** y qué evitan mencionar.

---

## Paso 4 — Leer las reseñas: la voz del cliente

Este paso es el que da valor a todo lo demás. De las reseñas saca:

- **Elogios recurrentes** — si tres personas distintas dicen lo mismo, es un patrón real y
  no una opinión. Guarda **cita literal + fuente** de al menos uno por patrón.
- **Quejas recurrentes** — igual. Tres quejas iguales describen un problema operativo real.
  Es material delicado: sirve para entender el negocio, **no** para echárselo en cara en un
  correo frío.
- **Las palabras que usa la gente** — cómo llama el cliente a lo que compra. Casi nunca
  coincide con cómo lo llama el negocio, y esa diferencia es oro para escribir.
- **En qué estado llega la gente** — con dolor, con miedo, comparando precio, con prisa,
  con una urgencia. Esto es el mapa emocional, y sale de las reseñas mucho mejor que de
  cualquier suposición.

---

## Paso 5 — Encontrar el detalle ancla

Elige **un solo detalle concreto, verificable y específico de este negocio**. Es lo que
hace que un correo no parezca un envío masivo.

Sirve: un patrón claro en las reseñas, algo que solo hace este negocio, una incoherencia
visible entre lo que prometen y lo que se puede hacer en su web, una carencia concreta.

No sirve: nada genérico del sector, nada que valga para cualquier competidor, y nada que no
puedas señalar con una fuente.

Si no encuentras ninguno, **dilo**. Un negocio sin detalle ancla es un lead peor y conviene
saberlo antes de escribirle.

---

## Paso 6 — Componer la huella

Guarda `huella-[slug-del-negocio].json` con esta forma. Los campos que no hayas podido
llenar van vacíos, nunca inventados:

```json
{
  "negocio": { "nombre": "", "web": "", "ciudad": "", "sector": "" },
  "fuentes": {
    "web": { "consultada": true, "paginas": [] },
    "resenas": { "consultadas": true, "cuantas": 0, "nota_media": null, "origen": "" },
    "redes": []
  },
  "que_vende": [{ "nombre_suyo": "", "que_es": "", "fuente": "" }],
  "como_hablan": {
    "trato": "tu | usted | mezclado",
    "registro": "",
    "expresiones_propias": [],
    "muletillas_de_folleto": []
  },
  "voz_del_cliente": {
    "elogios_recurrentes": [{ "patron": "", "cita": "", "fuente": "", "veces": 0 }],
    "quejas_recurrentes": [{ "patron": "", "cita": "", "fuente": "", "veces": 0 }],
    "palabras_que_usan": []
  },
  "mapa_emocional": [{ "perfil": "", "llega_asi": "", "necesita_antes_que_informacion": "" }],
  "detalle_ancla": { "detalle": "", "por_que_importa": "", "fuente": "" },
  "huecos_digitales": [],
  "confianza": {
    "verificado": [],
    "no_encontrado": [],
    "nivel": "alto | medio | bajo"
  }
}
```

Guarda además `huella-[slug].md`, la versión legible para una persona: el mapa emocional en
prosa, las citas literales que sostienen cada patrón, y el detalle ancla destacado.

**Lo que NO va en la huella:** precios, horarios, direcciones y teléfonos. Esos datos ya
viven en el lead y en `business.json`, y duplicarlos aquí es pedir que un día se
contradigan. La huella es cómo suena el negocio y qué le pasa a su gente, no su ficha.

---

## Paso 7 — Presentar

Muestra, en pocas líneas:

1. Cuántas fuentes se consultaron y cuántas reseñas se leyeron.
2. El **detalle ancla** en una frase.
3. Los patrones de elogio y de queja, con una cita de cada uno.
4. El nivel de confianza y qué no se pudo verificar.
5. Los dos archivos generados.

Si el nivel de confianza es bajo, dilo antes que nada y explica qué faltó.

No muestres precios sugeridos ni consejos de venta.

---

## Anexo A — De la huella al correo

El redactor recibe la huella y debe poder escribir sin inventar. Reglas:

- El correo se apoya en el **detalle ancla** y en **las palabras que usa la gente**, no en
  adjetivos sobre el negocio.
- Las quejas recurrentes **no se citan** al prospecto. Se usan para entender qué le duele y
  ofrecer lo que lo alivia, sin restregarlo.
- Si `confianza.nivel` es bajo, el correo se escribe corto y sin afirmaciones concretas
  sobre el negocio, o el lead se aparta para revisión manual.
- Nada de precios en un correo frío.

## Anexo B — De la huella al `tone.md` de un tenant

El `tone.md` de un cliente nuevo se compone así: **arquetipo del vertical** (que ya existe
en `templates/<vertical>/` del repo del agente) **+ la huella de este negocio**. De la
huella se usan:

- `mapa_emocional` → el mapa emocional del tono, tal cual.
- `voz_del_cliente.palabras_que_usan` → el vocabulario con el que debe hablar el agente.
- `como_hablan.expresiones_propias` → ejemplos de registro, que el modelo copia mucho mejor
  que los adjetivos.
- `como_hablan.muletillas_de_folleto` → la lista negra literal de expresiones prohibidas.

Recuerda que **editar `tone.md` no cambia el agente en vivo**: después hay que ejecutar
`npm run supabase:import -- <id>` en el repo del agente, porque la config de Supabase pisa
a los archivos del tenant.
