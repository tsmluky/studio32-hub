---
description: Genera tandas de prospección de las campañas del Hub (varias en paralelo) y las sube
argument-hint: "[nº de campañas a la vez, por defecto 3]"
---

Trabaja en `repos/studio32/studio32-hub` (o donde esté el repo `studio32-hub` en esta
máquina).

Argumento: `$ARGUMENTS` — cuántas campañas trabajar **a la vez**. Si viene vacío, **3**.
Nunca más de 4: cada una son decenas de páginas cargadas, y el límite de uso de la
suscripción es de todas juntas.

## Regla que manda sobre todas: esto tiene que terminar

Cada campaña de la pasada da **como mucho 30 leads**, y nunca más de los que le falten.
Verificar de verdad son 2-3 páginas por negocio, así que 30 es una pasada larga: por eso
se sube **de dos en dos o de tres en tres** según salen (B2), nunca al final. Si la pasada
se corta, lo subido ya está en el Hub; lo que falte se completa en otra.

Trabajar tres campañas a la vez **no cambia esa regla por campaña**: multiplica cuántas se
avanzan, no cuánto se estira cada una. Así una pasada da hasta ~90 leads.

No apruebes ni envíes nada, nunca. Eso lo hace una persona en el Hub.

---

## Parte A · Lo que haces tú (el que coordina)

### A1. Pon el repo al día y mira la cola

```bash
git pull --rebase
npm run outreach
```

- Si no hay campañas con leads por generar, dilo y para.

### A2. Elige las campañas

Lee antes `docs/PROSPECCION.md` → "Sectores que no funcionan por correo" y "Zonas ya
exprimidas".

- Elige por **probabilidad de dar fruto**, no por antigüedad.
- **Nunca dos campañas del mismo sector en la misma ciudad** en una pasada (por ejemplo
  dos de dentales en Valencia con zonas distintas). Se pisarían los candidatos: dos
  agentes investigando la misma clínica y dos importaciones subiéndola a la vez.
- Si una campaña es de un sector o zona que ya consta como muerto, no la asignes: ciérrala
  tú (`npm run outreach -- --cerrar <id> "motivo"`) y elige otra.
- Si hay menos campañas válidas que el número pedido, trabaja las que haya.

### A3. Lanza un agente por campaña, todos a la vez

Con la herramienta de agentes, **todos en el mismo mensaje** para que corran en paralelo
(tipo `general-purpose`). A cada uno le pasas este encargo, rellenado:

> Eres uno de varios agentes generando prospección para Studio32 a la vez. Tu campaña,
> y solo esa:
> - Campaña: `<id>` — `<nombre>`
> - Sector: `<sector>` · Zona: `<zona>` · Faltan: `<n>` (tú haces como mucho 30, y nunca más de los que faltan)
> - Oferta: `<oferta>` · Notas: `<notas o "ninguna">`
>
> Trabaja en el repo `studio32-hub` (`<ruta absoluta del repo en esta máquina>`). Lee
> `.claude/commands/prospectar.md` → **Parte B** y síguela entera, al pie de la letra.
> Tu archivo JSON se llama `tanda-<id corto de la campaña>.json` y va en
> `<carpeta temporal de la sesión>`, nunca en el repo.
>
> Cuando termines, responde SOLO con: cuántos leads subiste, cuáles cayeron y por qué
> (una línea cada uno), si cerraste la campaña y cuántos le faltan.

### A4. Cuenta qué pasó, corto

Cuando vuelvan todos:

- Cuántos leads subieron en total y cómo quedó la bandeja (vuelve a lanzar
  `npm run outreach` y copia la línea "Bandeja: …").
- Por campaña: cuántos subieron, **cuáles cayeron y por qué** (es lo más útil: dice si el
  criterio de búsqueda sirve) y qué queda pendiente.
- Si algún agente falló o se quedó a medias, dilo tal cual. Lo subido ya está en el Hub.
- Si hay algo nuevo que valga para próximas pasadas (una fuente de reseñas que funciona,
  una zona agotada, un obstáculo nuevo), apúntalo en `docs/PROSPECCION.md` y haz commit y
  push de ese archivo. **Solo aprendizajes, nunca datos de contacto de negocios.**

---

## Parte B · Trabajo por campaña (lo que hace cada agente)

### B1. Criba barata antes de investigar a fondo

Este es el paso que ahorra el tiempo. **No te lances a fondo con cada negocio.**

1. Mira qué negocios de tu zona ya tenemos, para no investigarlos otra vez:
   ```bash
   npm run outreach -- --conocidos "<zona>"
   ```
2. Saca candidatos del sector y la zona que **no** estén en esa lista, por rondas de
   10-12: la criba tira más de la mitad, así que para 30 leads harán falta varias. Cuando
   una fuente se agote (el listado no da más páginas), pasa a la siguiente.
3. Descarta de entrada: cadenas, franquicias, y los que no tengan web propia.
4. **Comprueba que hay correo público** antes de nada más. Sin correo el lead no puede
   entrar, así que investigarlo es tiempo tirado. El correo tiene que ser una dirección sin
   tildes ni eñes: el servidor no las envía y el importador las descarta.

Si tras la primera ronda quedan menos de 3 con correo, **para ahí**: ciérrala (B3)
explicándolo y no sigas. Si en rondas posteriores la zona deja de dar candidatos nuevos,
para también: la zona está agotada, dilo al terminar aunque no llegues a 30.

### B2. Investiga y sube, de dos en dos

Para los que pasaron la criba, y **como mucho 30** (nunca más de los que falten):

- Carga su web y busca sus reseñas. Nada inventado: ni correos, ni teléfonos, ni
  recuentos, ni citas. Si no lo has leído, no lo escribes.
- Sigue `skills/studio32-lead-prospector/SKILL.md` → Modo C para la forma del JSON y la
  huella. **La frase de oferta y un solo tratamiento (tú o vosotros) son requisito de
  entrada**, no estilo: un correo sin ellos no se sube.
- El cuerpo **no lleva saludo ni presentación** (empieza por lo que viste del negocio) y
  termina en "Un saludo y gracias por vuestro tiempo," **sin nombre**: el "Hola, soy…" y
  la firma los pone el envío con el nombre de quien apruebe.
- La oferta va en primera persona ("Es justo lo que montamos: …"). **Nunca ofrezcas
  llamadas de teléfono** (el agente es solo WhatsApp) ni "un ejemplo real".
- Después de la oferta, **una sola frase con los otros servicios**, que empieza por
  "Aparte del asistente, también hacemos…": webs con reserva online, la ficha de Google o
  el correo con el nombre del negocio. Si la huella tiene un hueco que encaje (correo en
  Gmail, reserva a través de Doctoralia, web solo en español…), la frase se liga a él y
  ese hueco va a `evidencia`. Si no, se queda genérica. Nunca una lista ni un reproche.
- El cierre va en su propio párrafo y nombra el asistente, para que no se confunda con
  las webs: "¿Os enseño cómo funcionaría el asistente en vuestra clínica?" (o "vuestro
  centro").
- El asunto es corto y llano, con el nombre del negocio: "Pedir cita en X", "Las citas en
  X", "El WhatsApp de X". Nada de ganchos ni asuntos ingeniosos: eso es lo que suena a
  generado.
- **Tipografía de persona, no de máquina.** Comillas rectas " " para citar (nunca « » ni
  “ ”), tres puntos y no el carácter …, y **ninguna raya (— o –)**: coma, dos puntos o
  punto. El envío para cualquier correo con una raya, así que un borrador con ella no
  llegará a salir. Antes de subir, `npm run outreach:revisar` dice qué pararía el envío.

**Sube en cuanto tengas 2 o 3 listos**, no al final:

```bash
npm run outreach -- <ruta-del-json>
```

Reimportar es seguro: respeta lo que ya tenga trabajo hecho. Así, si la pasada se corta,
lo hecho ya está en el Hub en vez de perderse. Usa siempre el mismo archivo y ve
añadiendo leads: reimportar los primeros no los duplica.

Escribe el JSON en la carpeta temporal de la sesión, nunca en el repo: lleva datos de
contacto de negocios reales y el repositorio es público.

### B3. Si la campaña no da para más, ciérrala

Para que deje de aparecer en la cola y que quien la pidió sepa por qué:

```bash
npm run outreach -- --cerrar <id-campaña> "motivo en una línea"
```

No toques `docs/PROSPECCION.md` ni hagas commits: eso lo hace quien coordina, con lo que
le cuentes.
